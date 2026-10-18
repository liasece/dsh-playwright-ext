/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { debugLog } from './relayConnection';
import { PendingConnections } from './pendingConnection';
import { ConnectedTabGroup, cleanupStalePlaywrightGroups, isNonDebuggableUrl, ungroupTabs, uniqueGroupStyle } from './connectedTabGroup';

type PageMessage = {
  type: 'connectionRequested';
  mcpRelayUrl: string;
} | {
  type: 'getTabs';
} | {
  type: 'connectToTab';
  // Picked in the connect page; absent on the token-bypass path where no tab
  // selection happens.
  tab?: chrome.tabs.Tab;
  clientName?: string;
} | {
  type: 'getConnectionStatus';
} | {
  type: 'disconnect';
  connectionId: number;
} | {
  type: 'keepalive';
} | {
  type: 'dsh-overlay-query';
};

function notify(id: string, title: string, message: string): void {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message,
  }).catch(() => {});
}

class PlaywrightExtension {
  private _connections = new Map<number, ConnectedTabGroup>();
  private _lastConnectionId = 0;
  private _pendingConnections = new PendingConnections();
  // Service worker restarts lose all connection state, so any existing
  // Playwright groups are stale. Connections wait on this before reconciling.
  private _cleanupPromise: Promise<void>;

  constructor() {
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
    this._cleanupPromise = cleanupStalePlaywrightGroups();
    chrome.tabs.onActivated.addListener(this._onTabActivated.bind(this));
    void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined && !this._isAgentTab(tab))
        this._lastUserActiveTabId = tab.id;
    }).catch(() => {});
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    if (message.type === 'dsh-overlay-query') {
      const tabId = sender.tab?.id;
      const visible = tabId !== undefined && [...this._connections.values()].some(group => group.isTabAttached(tabId));
      sendResponse({ visible });
      return false;
    }
    switch (message.type) {
      case 'connectionRequested': {
        const selectorTabId = sender.tab!.id!;
        this._releaseConnectPage(selectorTabId).then(() => {
          this._pendingConnections.create(selectorTabId, message.mcpRelayUrl);
          sendResponse({ success: true });
        });
        return true;
      }
      case 'getTabs':
        this._getTabs(sender.tab?.id).then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab': {
        // Token-bypass (no specific pick) falls back to the connect page itself
        // so `ConnectedTabGroup` always has a concrete tab to start from. Both
        // sender.tab and UI-supplied tabs come from chrome.tabs.query / runtime
        // message sender, where `id` is always defined.
        const selectedTab = (message.tab ?? sender.tab!) as chrome.tabs.Tab & { id: number };
        this._connectTab(sender.tab!.id!, selectedTab, message.clientName).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      }
      case 'getConnectionStatus':
        sendResponse({
          connections: [...this._connections].map(([id, group]) => ({
            id,
            clientName: group.clientName,
            connectedTabIds: group.connectedTabIds(),
          })),
        });
        return false;
      case 'disconnect':
        this._connections.get(message.connectionId)?.close('User disconnected');
        sendResponse({ success: true });
        return false;
      case 'keepalive':
        // Connect page pings us every ~20s so receiving this message resets
        // the MV3 service worker idle timer and keeps the relay WebSocket alive.
        return false;
    }
  }

  private _lastUserActiveTabId: number | undefined;
  private _lastAgentActionAt = 0;

  private _isAgentTab(tab: chrome.tabs.Tab): boolean {
    if (tab.url?.startsWith(`chrome-extension://${chrome.runtime.id}/connect.html`))
      return true;
    if (tab.id === undefined)
      return false;
    return [...this._connections.values()].some(group => group.isTabInGroup(tab.id!));
  }

  private async _onTabActivated({ tabId }: chrome.tabs.TabActiveInfo): Promise<void> {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab)
      return;
    const isConnect = !!tab.url?.startsWith(`chrome-extension://${chrome.runtime.id}/connect.html`);
    const isAgent = this._isAgentTab(tab);
    if (!isAgent) {
      this._lastUserActiveTabId = tabId;
      return;
    }
    // The connect page is never a user tab: always restore the user's tab.
    // Group tabs may be clicked by the user intentionally; only override a
    // recent agent-caused activation.
    if (!isConnect && Date.now() - this._lastAgentActionAt > 3000)
      return;
    let previousId = this._lastUserActiveTabId;
    if (previousId !== undefined) {
      const previous = await chrome.tabs.get(previousId).catch(() => null);
      if (!previous || this._isAgentTab(previous))
        previousId = undefined;
    }
    if (previousId === undefined) {
      const tabs = await chrome.tabs.query({ windowId: tab.windowId }).catch(() => []);
      const candidates = tabs
          .filter(candidate => candidate.id !== undefined && candidate.id !== tabId && !this._isAgentTab(candidate))
          .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
      previousId = candidates[0]?.id;
    }
    if (previousId !== undefined && previousId !== tabId)
      void chrome.tabs.update(previousId, { active: true }).catch(() => {});
  }

  private _updateGlobalBadge(): void {
    const connected = this._connections.size > 0;
    void Promise.all([
      chrome.action.setBadgeText({ text: connected ? 'DSH' : '' }),
      chrome.action.setBadgeBackgroundColor({ color: '#0169cc' }),
      chrome.action.setTitle({ title: connected ? 'DSH is connected' : 'DSH Playwright Extension' }),
    ]).catch(() => {});
  }

  private async _connectTab(selectorTabId: number, tab: chrome.tabs.Tab & { id: number }, clientName: string | undefined): Promise<void> {
    try {
      await this._cleanupPromise;
      this._releaseTab(selectorTabId);
      if (tab.id !== selectorTabId && this._connectedTabIds().has(tab.id))
        throw new Error('This tab is already connected to another client');

      const connection = await this._pendingConnections.take(selectorTabId);
      if (!connection)
        throw new Error('Pending client connection closed');

      const id = ++this._lastConnectionId;
      const taken = [...this._connections.values()].map(group => group.groupStyle);
      const group = new ConnectedTabGroup(connection, tab, clientName, uniqueGroupStyle(clientName, taken), tabId => this._pendingConnections.has(tabId));
      group.onclose = () => {
        this._connections.delete(id);
        this._updateGlobalBadge();
        notify('dsh-disconnect-' + id, 'DSH disconnected', 'The agent stopped using this Chrome tab group.');
      };
      group.onagentaction = () => { this._lastAgentActionAt = Date.now(); };
      this._connections.set(id, group);
      this._updateGlobalBadge();
      notify('dsh-connect-' + id, 'DSH connected', 'Agent tab group: ' + group.groupStyle.title);

      // DSH fork: keep the user's active tab and window focus untouched.

      if (tab.id !== selectorTabId)
        await chrome.tabs.remove(selectorTabId).catch(() => {});
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tab.id}:`, error.message);
      throw error;
    }
  }

  // Chrome may create the connect page inside the active client's group.
  private async _releaseConnectPage(tabId: number): Promise<void> {
    this._releaseTab(tabId);
    await ungroupTabs([tabId]);
  }

  private _releaseTab(tabId: number): void {
    for (const group of this._connections.values())
      group.releaseTab(tabId);
  }

  private async _getTabs(selectorTabId: number | undefined): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    const connectedTabIds = this._connectedTabIds();
    return tabs.filter(tab => !isNonDebuggableUrl(tab.url) && (tab.id === selectorTabId || !connectedTabIds.has(tab.id!)));
  }

  private _connectedTabIds(): Set<number> {
    return new Set([...this._connections.values()].flatMap(group => group.connectedTabIds()));
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }
}

new PlaywrightExtension();
