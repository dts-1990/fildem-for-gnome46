'use strict';

// import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import GObject from 'gi://GObject?version=2.0';
import Meta from 'gi://Meta';
import St from 'gi://St?';
import Shell from 'gi://Shell';

import { Extension as GExtension } from "resource:///org/gnome/shell/extensions/extension.js";

const WinTracker = Shell.WindowTracker.get_default();

import { FildemGlobalMenuSettings as Settings } from './settings.js';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as WindowMenu from 'resource:///org/gnome/shell/ui/windowMenu.js';


function log(msg) {
	const debug = true;
	if (debug)
		console.log('[FILDEM_MENU] ' + msg);
}


const WindowActions = class WindowActions {
	constructor() {
		this._win = global.display.get_focus_window();
		this.actions = [];
	}

	// gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-3-36/js/ui/windowMenu.js
	getActions() {
		let type = this._win.get_window_type();
		let win = this._win;

		if (win.can_minimize())
			this.actions.push('Minimize');

		if (win.can_maximize())
			this.actions.push(win.get_maximized() ? 'Unmaximize' : 'Maximize');

		if (win.allows_move())
			this.actions.push('Move');

		if (win.allows_resize())
			this.actions.push('Resize');

		if (win.titlebar_is_onscreen() && type != Meta.WindowType.DOCK && type != Meta.WindowType.DESKTOP)
			this.actions.push('Move Titlebar Onscreen')

		if (win.get_maximized() == Meta.MaximizeFlags.BOTH
			|| type == Meta.WindowType.DOCK
			|| type == Meta.WindowType.DESKTOP
			|| type == Meta.WindowType.SPLASHSCREEN) {

			this.actions.push('Always on Top' + (win.is_above() ? ' ✓' : ''));
		}

		if (Main.sessionMode.hasWorkspaces
			&& (!Meta.prefs_get_workspaces_only_on_primary() || win.is_on_primary_monitor())) {

			let isSticky = win.is_on_all_workspaces();

			if (win.is_always_on_all_workspaces()) {
				this.actions.push('Always on Visible Workspace' + (isSticky ? ' ✓' : ''));
			}

			if (!isSticky) {
				let workspace = win.get_workspace();
				if (workspace != workspace.get_neighbor(Meta.MotionDirection.LEFT))
					this.actions.push('Move to Workspace Left');

				if (workspace != workspace.get_neighbor(Meta.MotionDirection.RIGHT))
					this.actions.push('Move to Workspace Right');

				if (workspace != workspace.get_neighbor(Meta.MotionDirection.UP))
					this.actions.push('Move to Workspace Up');

				if (workspace != workspace.get_neighbor(Meta.MotionDirection.DOWN))
					this.actions.push('Move to Workspace Down');
			}
		}

		let display = global.display;
		let nMonitors = display.get_n_monitors();
		let monitorIndex = win.get_monitor();
		if (nMonitors > 1 && monitorIndex >= 0) {
			let dir = Meta.DisplayDirection.UP;
			let upMonitorIndex = display.get_monitor_neighbor_index(monitorIndex, dir);
			if (upMonitorIndex != -1)
				this.actions.push('Move to Monitor Up');

			dir = Meta.DisplayDirection.DOWN;
			let downMonitorIndex = display.get_monitor_neighbor_index(monitorIndex, dir);
			if (downMonitorIndex != -1)
				this.actions.push('Move to Monitor Down');

			dir = Meta.DisplayDirection.LEFT;
			let leftMonitorIndex = display.get_monitor_neighbor_index(monitorIndex, dir);
			if (leftMonitorIndex != -1)
				this.actions.push('Move to Monitor Left');

			dir = Meta.DisplayDirection.RIGHT;
			let rightMonitorIndex = display.get_monitor_neighbor_index(monitorIndex, dir);
			if (rightMonitorIndex != -1)
				this.actions.push('Move to Monitor Right');
		}

		if (win.can_close())
			this.actions.push('Close');

		return this.actions;
	}

	_doAction(action) {
		if (action.endsWith(' ✓')) {
			action = action.substr(0, action.length - 2);
		}
		let win = this._win;
		switch (action) {
			case 'Minimize':
				win.minimize();
				break;
			case 'Unmaximize':
				win.unmaximize(Meta.MaximizeFlags.BOTH);
				break;
			case 'Maximize':
				win.maximize(Meta.MaximizeFlags.BOTH);
				break;
			case 'Move':
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
					WindowMenu.WindowMenu.prototype._grabAction(win, Meta.GrabOp.KEYBOARD_MOVING, global.display.get_current_time_roundtrip());
				});
				break;
			case 'Resize':
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
					WindowMenu.WindowMenu.prototype._grabAction(win, Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN, global.display.get_current_time_roundtrip());
				});
				break;
			case 'Move Titlebar Onscreen':
				win.shove_titlebar_onscreen();
				break;
			case 'Always on Top':
				if (win.is_above())
					win.unmake_above();
				else
					win.make_above();
				break;
			case 'Always on Visible Workspace':
				if (win.is_on_all_workspaces())
					win.unstick();
				else
					win.stick();
				break;
			case 'Move to Workspace Left':
				this._moveToWorkspace(Meta.MotionDirection.LEFT);
				break;
			case 'Move to Workspace Right':
				this._moveToWorkspace(Meta.MotionDirection.RIGHT);
				break;
			case 'Move to Workspace Up':
				this._moveToWorkspace(Meta.MotionDirection.UP);
				break;
			case 'Move to Workspace Down':
				this._moveToWorkspace(Meta.MotionDirection.DOWN);
				break;
			case 'Move to Monitor Up':
				this._moveToMonitor(Meta.DisplayDirection.UP);
				break;
			case 'Move to Monitor Down':
				this._moveToMonitor(Meta.DisplayDirection.DOWN);
				break;
			case 'Move to Monitor Left':
				this._moveToMonitor(Meta.DisplayDirection.LEFT);
				break;
			case 'Move to Monitor Right':
				this._moveToMonitor(Meta.DisplayDirection.RIGHT);
				break;
			case 'Close':
				win.delete(global.get_current_time());
				break;
		}
	}

	_moveToWorkspace(dir) {
		let workspace = this._win.get_workspace();
		this._win.change_workspace(workspace.get_neighbor(dir));
	}

	_moveToMonitor(dir) {
		let monitorIndex = window.get_monitor();
		let newMonitorIndex = global.display.get_monitor_neighbor_index(monitorIndex, dir);
		if (newMonitorIndex != -1) {
			this._win.move_to_monitor(newMonitorIndex);
		}
	}
}

/**
 * A single Button like File, Edit, etc.
 */
var MenuButton = GObject.registerClass(
class MenuButton extends PanelMenu.Button {

	_init(label, menuBar) {
		label = label.replace('_', '');
		super._init(0.0, label);
		this._label = label;
		this._menuBar = menuBar;

		this.box = new St.BoxLayout({style_class: 'panel-status-menu-box menubar-button'});
		this.labelWidget = new St.Label({
			text: this._label,
			y_align: Clutter.ActorAlign.CENTER,
			reactive: true
		});
		this.box.add_child(this.labelWidget);
		this.add_child(this.box);

		this.menu.connect('open-state-changed', this._onOpenStateChanged.bind(this));
	}

	_onStyleChanged(actor) {
		super._onStyleChanged(actor);
		let padding = this._menuBar.extension.settings.get_int('min-padding');
		this._minHPadding = padding;
		this._natHPadding = padding;
	}

	_onOpenStateChanged(menu, isOpen) {
		// PanelMenu.Button's own _onOpenStateChanged (connected by setMenu())
		// is what keeps this button visually highlighted ('active' pseudo
		// class) while its menu is open; overriding the method without
		// calling super silently dropped that behavior.
		super._onOpenStateChanged(menu, isOpen);

		if (isOpen && this.menu.isEmpty())
			this._menuBar.requestMenuTree(this._label);

		this._menuBar.onMenuOpenStateChanged();
	}

	populateMenu(items) {
		this.menu.removeAll();
		for (let item of items)
			this._addMenuItem(this.menu, item);
	}

	_addMenuItem(parentMenu, item) {
		if (item.separator) {
			parentMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			return;
		}

		let label = item.label.replace('_', '');

		if (item.children && item.children.length > 0) {
			let subMenuItem = new PopupMenu.PopupSubMenuMenuItem(label, false);
			subMenuItem.setSensitive(item.enabled);
			for (let child of item.children)
				this._addMenuItem(subMenuItem.menu, child);
			parentMenu.addMenuItem(subMenuItem);
			return;
		}

		let menuItem = new PopupMenu.PopupMenuItem(label);
		menuItem.setSensitive(item.enabled);
		if (item.toggleType)
			menuItem.setOrnament(item.toggleState ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);

		menuItem.connect('activate', () => {
			this._menuBar.activateMenuItem(item.selection);
		});
		parentMenu.addMenuItem(menuItem);
	}
});

const Cache = class Cache {
	constructor() {
		this.N = 10;
		this.lru = [];
		this.entries = {};
		this.lastQueriedKey = '';
	}

	get(key) {
		this.lastQueriedKey = key;
		return this.entries[key];
	}

	_set(key, value) {
		if (this.entries[key]) {
			const oldItem = this.lru.splice(this.lru.indexOf(key), 1);
		}
		this.lru.push(key);
		this.entries[key] = value;

		if (this.lru.length > this.N) {
			const toRemove = this.lru.pop();
			this.entries[toRemove] = undefined;
		}
	}

	withCache(f) {
		const self = this;
		const g = (param) => {
			self._set(self.lastQueriedKey, param);
			f(param);
		}
		return g;
	}
}

/**
 * Shows the focused app's icon + name + window title, to the left of the
 * menu buttons — replaces needing a separate "window title" extension,
 * and (unlike a standalone extension listening to notify::focus-window on
 * its own) stays in sync with MenuBar's own focus/menu-open bookkeeping,
 * so it doesn't flicker when one of our own menus grabs a modal.
 */
var WindowTitleIndicator = GObject.registerClass(
class WindowTitleIndicator extends PanelMenu.Button {
	_init(menuBar) {
		super._init(0.5, 'Window Title');
		this._menuBar = menuBar;

		// Clicking opens the app's own menu (Quit, New Window, etc.),
		// same as a normal app-menu indicator. addToStatusArea() (called by
		// MenuBar right after construction) registers this.menu with
		// Main.panel.menuManager automatically — an extra manual addMenu()
		// call here double-registers it and made the first click a no-op.
		this._appMenu = new AppMenu(this);
		this.setMenu(this._appMenu);
		// Opening this pushes a modal too, so it must feed into the same
		// "a menu is open" bookkeeping as the File/Edit/... buttons, or
		// _onWindowSwitched will tear the panel down out from under it.
		this._appMenu.connect('open-state-changed', () => this._menuBar.onMenuOpenStateChanged());

		// A real child actor (whether a plain background widget or an
		// St.DrawingArea) is bound by `this`'s own preferred-size/allocation
		// math: PanelMenu.Button reserves extra hover/highlight padding
		// around its child that the child itself never actually gets
		// allocated, so any descendant-painted background always came out
		// smaller than the hover-highlight box (e.g. 129px child vs 154px
		// button). A Clutter.Image content layer would sidestep that (content
		// doesn't participate in layout at all) — tried rendering the
		// gradient with Cairo into an ImageSurface for that, but this
		// build's gjs cairo binding doesn't expose ImageSurface.getData()
		// at all, so there's no way to get the pixels back out. Falling
		// back to a plain CSS background on `this` directly instead: only
		// a 2-stop gradient (St's CSS engine doesn't support more), but
		// since it's `this`'s own background rather than a descendant's,
		// it's painted across `this`'s exact box with no sizing mismatch.
		this._interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
		this._accentChangedId = this._interfaceSettings.connect('changed::accent-color', () => this._updateGradientStyle());
		this._updateGradientStyle();

		this.box = new St.BoxLayout({style_class: 'panel-button', y_align: Clutter.ActorAlign.CENTER});
		this._icon = new St.Icon({y_align: Clutter.ActorAlign.CENTER});
		this._iconPadding = new St.Label({y_align: Clutter.ActorAlign.CENTER});
		this._label = new St.Label({
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'fildem-window-title-label'
		});
		this.box.add_child(this._icon);
		this.box.add_child(this._iconPadding);
		this.box.add_child(this._label);
		this.add_child(this.box);

		this._titleNotifyId = 0;
		this._trackedWindow = null;
		this._trackedApp = null;

		this._showIcon = true;
		this._showAppName = true;
		this._showWindowTitle = true;

		this.applySettings();
		this.clear();
	}

	isOpen() {
		return this._appMenu.isOpen;
	}

	// GNOME's accent-color setting (Settings > Appearance) is what the
	// user actually thinks of as "their" TopBar color — the panel's own
	// background is usually a near-grayscale dark/light tone with no hue
	// to rotate, which is why an earlier attempt at deriving the gradient
	// from it came out flat gray. Re-reads live, so it adapts if the user
	// changes their accent color later (see the 'changed::accent-color'
	// listener in _init).
	static ACCENT_COLORS = {
		blue: [53, 132, 228], teal: [33, 144, 164], green: [58, 148, 74],
		yellow: [200, 136, 0], orange: [237, 91, 0], red: [230, 45, 66],
		pink: [213, 97, 153], purple: [145, 65, 172], slate: [111, 131, 150],
	};

	_getAccentColor() {
		try {
			let name = this._interfaceSettings.get_string('accent-color');
			if (WindowTitleIndicator.ACCENT_COLORS[name])
				return WindowTitleIndicator.ACCENT_COLORS[name];
		} catch (e) {
			// 'accent-color' key not present on older GNOME versions.
		}
		return WindowTitleIndicator.ACCENT_COLORS.blue;
	}

	// Sets `this`'s own CSS background — applied directly to `this` (not a
	// descendant), it's painted across `this`'s exact box, so it can't
	// mismatch the hover/active highlight the way a child actor's
	// background did.
	_updateGradientStyle() {
		let [ar, ag, ab] = this._getAccentColor();
		// Rotate the accent color's hue for the second stop so the
		// gradient reads as two-tone rather than a single-hue fade, while
		// staying clearly derived from (and adapting with) the user's
		// accent color.
		let [br, bg, bb] = this._rotateHue(ar, ag, ab, 80);
		const alpha = 0.55;
		this.set_style(
			`background-gradient-start: rgba(${ar},${ag},${ab},${alpha}); ` +
			`background-gradient-end: rgba(${br},${bg},${bb},${alpha}); ` +
			'background-gradient-direction: horizontal; ' +
			'border-radius: 6px;'
		);
	}

	// Rotates an RGB color's hue by `degrees` on the HSL wheel, keeping
	// its saturation/lightness — used to derive a second gradient stop
	// that's clearly a different color but stays related to the source.
	_rotateHue(r, g, b, degrees) {
		r /= 255; g /= 255; b /= 255;
		let max = Math.max(r, g, b), min = Math.min(r, g, b);
		let l = (max + min) / 2;
		let h, s;
		if (max === min) {
			h = s = 0;
		} else {
			let d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				default: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}

		h = (h + degrees / 360) % 1;
		if (h < 0)
			h += 1;

		const hue2rgb = (p, q, t) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		let r2, g2, b2;
		if (s === 0) {
			r2 = g2 = b2 = l;
		} else {
			let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			let p = 2 * l - q;
			r2 = hue2rgb(p, q, h + 1 / 3);
			g2 = hue2rgb(p, q, h);
			b2 = hue2rgb(p, q, h - 1 / 3);
		}
		return [Math.round(r2 * 255), Math.round(g2 * 255), Math.round(b2 * 255)];
	}

	applySettings() {
		let settings = this._menuBar.extension.settings;
		this._showIcon = settings.get_boolean('title-show-icon');
		this._showAppName = settings.get_boolean('title-show-app-name');
		this._showWindowTitle = settings.get_boolean('title-show-window-title');
		this._icon.icon_size = settings.get_int('title-icon-size');

		this._syncIconVisibility();
		this._updateLabel(this._trackedApp, this._trackedWindow);
	}

	setWindow(app, win) {
		this._trackTitle(win);
		this._trackedApp = app || null;
		if (app)
			this._appMenu.setApp(app);

		if (app)
			this._icon.set_gicon(app.get_icon());
		this._syncIconVisibility();

		this._updateLabel(app, win);
		this.show();
	}

	clear() {
		this._trackTitle(null);
		this._trackedApp = null;
		this._syncIconVisibility();
		this._label.set_text('');
		this.hide();
	}

	_syncIconVisibility() {
		let show = this._showIcon && !!this._trackedApp;
		this._icon.visible = show;
		this._iconPadding.set_text(show ? '   ' : '');
	}

	_trackTitle(win) {
		if (this._trackedWindow && this._titleNotifyId) {
			this._trackedWindow.disconnect(this._titleNotifyId);
			this._titleNotifyId = 0;
		}
		this._trackedWindow = win || null;
		if (this._trackedWindow) {
			this._titleNotifyId = this._trackedWindow.connect('notify::title', () => {
				this._updateLabel(this._trackedApp, this._trackedWindow);
			});
		}
	}

	_updateLabel(app, win) {
		let appName = (this._showAppName && app) ? app.get_name() : '';
		let title = (this._showWindowTitle && win) ? win.get_title() : '';
		let text = (appName && title && title !== appName) ? `${appName} — ${title}` : (appName || title);
		this._label.set_text(text || '');
	}

	destroy() {
		this._trackTitle(null);
		if (this._accentChangedId) {
			this._interfaceSettings.disconnect(this._accentChangedId);
			this._accentChangedId = 0;
		}
		Main.panel.menuManager.removeMenu(this._appMenu);
		super.destroy();
	}
});

/**
 * This is a manager not a container
 */
const MenuBar = class MenuBar {
	constructor(proxy, extension) {
		this._menuButtons = [];
		this._proxy = proxy;
		this.extension = extension;
		// pixels from x_0 to the start of the menu
		this._width_offset = 300;
		this.MARGIN_FIRST_ELEMENT = 4;
		this._isShowingMenu = false;

		this._cache = new Cache();

		this._titleIndicator = new WindowTitleIndicator(this);
		// Position > 0 so extensions pinned to position 0 (e.g. Space Bar)
		// stay leftmost regardless of extension load order on Shell restart.
		Main.panel.addToStatusArea('fildem-window-title', this._titleIndicator, 1, 'left');

		this._notifyFocusWinId = global.display.connect('notify::focus-window', this._onWindowSwitched.bind(this));
		this._proxy.listeners['SendTopLevelMenus'].push(this._cache.withCache(this.setMenus.bind(this)));
		this._proxy.listeners['MenuOnOff'].push(this._onMenuOnOff.bind(this));
		this._proxy.listeners['SendMenuTree'].push(this._onSendMenuTree.bind(this));
		Main.panel.reactive = true;
		Main.panel.track_hover = true;

		this._panelEvHandlers = [];
		this._forceShowMenu = false;
		this._showAppMenuButton = false;
		this.setForceShowMenu();
		this.setHideAppMenuButton();

		Main.overview.connect('showing', this._onOverviewOpened.bind(this));
		Main.overview.connect('hiding', this._onOverviewClosed.bind(this));
	}

	setForceShowMenu() {
		this._forceShowMenu = !this.extension.settings.get_boolean('show-only-when-hover');

		if (!this._forceShowMenu) {
			this._panelEvHandlers.push(Main.panel.connect('enter-event', this._onPanelEnter.bind(this)));
			this._panelEvHandlers.push(Main.panel.connect('leave-event', this._onPanelLeave.bind(this)));
		} else {
			for (let h of this._panelEvHandlers) {
				Main.panel.disconnect(h);
			}
			this._panelEvHandlers = [];
		}
	}

	setHideAppMenuButton() {
		this._showAppMenuButton = !this.extension.settings.get_boolean('hide-app-menu');

		let appBtn = Main.panel._leftBox.get_children().filter(item => {
			item.get_first_child().constructor.name == 'AppMenuButton'
		});
		if (appBtn.length > 0) {
			this._appMenuButton = appBtn[0];
		}
		this._restoreLabel();
	}

	addMenuButton(label, setmargin) {
		let menuButton = new MenuButton(label, this);
		this._menuButtons.push(menuButton);
		const nItems = Main.panel._leftBox.get_children().length;
		menuButton.hide();
		if (setmargin)
			menuButton.set_style('margin-left: '+ this.MARGIN_FIRST_ELEMENT + 'px')
		Main.panel.addToStatusArea(label, menuButton, nItems, 'left');
	}

	setMenus(menus) {
		// The expansion/shrink can be annoying, so we only do it
		// when there’s no menus
		if (menus.length === 0) {
			this._hideMenu();
		}
		this.removeAll();
		let first = true;
		for (let menu of menus) {
			this.addMenuButton(menu, first);
			first = false;
		}
		for (let button of this._menuButtons) {
			this.requestMenuTree(button._label);
		}
		if (this._forceShowMenu && !Main.overview.visibleTarget) {
			this._onPanelEnter();
		}
	}

	requestMenuTree(label) {
		this._proxy.RequestMenuTree(label);
	}

	activateMenuItem(selection) {
		this._proxy.ActivateMenuItem(selection);
	}

	_onSendMenuTree(label, treeJson) {
		let button = this._menuButtons.find(b => b._label === label);
		if (!button)
			return;

		// Rebuilding items while the menu is open destroys and recreates
		// the actor under the user's cursor mid-click, which can eat the
		// click's press/active visual feedback even though the click still
		// registers. The prefetched content is already showing; skip.
		if (button.menu.isOpen)
			return;

		let items = [];
		try {
			items = JSON.parse(treeJson);
		} catch (e) {
			log(`Failed to parse menu tree for ${label}: ${e}`);
		}

		button.populateMenu(items);
	}

	onMenuOpenStateChanged() {
		this._isShowingMenu = this._menuButtons.some(b => b.menu.isOpen) ||
			(this._titleIndicator && this._titleIndicator.isOpen());
		if (!this._isShowingMenu) {
			this._onPanelLeave();
			// _onWindowSwitched() skips its rebuild while a menu is open,
			// so catch up here in case a real focus change happened
			// (or was triggered by the menu's own modal grab) meanwhile.
			GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
				this._onWindowSwitched();
				return GLib.SOURCE_REMOVE;
			});
		}
	}

	_onPanelEnter() {
		if (this._menuButtons.length === 0 || Main.overview.visibleTarget)
			return;

		this._hideAppMenuButton();
		this._showMenu();
	}

	// Hides the label and calculates the width
	_hideAppMenuButton() {
		let width = 0;
		for (let el of Main.panel._leftBox.get_children()) {
			let firstChild = el.get_first_child();
			if (firstChild === this._menuButtons[0]) {
				this._width_offset = width;
				break;
			}
			if (firstChild.constructor.name == 'AppMenuButton') {
				// [Deprecated]
				this._appMenuButton = firstChild;
				let label = firstChild._label;

				if (!this._showAppMenuButton) {
					label.hide();
				}
				this._width_offset = width + el.width;
				// break;
			}
			if (el.is_visible()) {
				width += el.get_width();
			}
		}
	}

	_showMenu() {
		this._menuButtons.forEach(btn => btn.show());
		this._menuButtons.forEach(btn => btn.ease({
			opacity: 255,
			mode: Clutter.AnimationMode.EASE_OUT_QUART,
			duration: 250
		}));
	}

	_onPanelLeave() {
		if (this._isShowingMenu || this._forceShowMenu)
			return;

		this._hideMenu();
	}

	_hideMenu() {
		this._menuButtons.forEach(btn => btn.ease({
			opacity: 0,
			mode: Clutter.AnimationMode.EASE_OUT_QUART,
			duration: 100,
			onComplete: () => { this._menuButtons.forEach(btn => btn.hide()); this._restoreLabel() }
		}));
	}

	_restoreLabel() {
		if (this._appMenuButton) {
			this._appMenuButton._label.show();
		}
	}

	_onMenuOnOff(on) {
		if (on) {
			this._onPanelEnter();
			this.onButtonClicked('__fildem_move', this._width_offset);
		} else {
			this._isShowingMenu = false;
			this._onPanelLeave();
		}
	}

	onButtonClicked(label) {
		this._isShowingMenu = true;
		this._proxy.EchoSignal(label, this._width_offset);
	}

	removeAll() {
		for (let e of this._menuButtons) {
			if (e.menu && e.menu.isOpen)
				e.menu.close(BoxPointer.PopupAnimation.NONE);
			e.destroy();
		}
		this._menuButtons = [];
	}

	_onWindowSwitched() {
		// Opening one of our own menus does Main.pushModal(), which shifts
		// window focus and can itself trigger notify::focus-window. If we
		// tore down the menu bar here, we'd destroy the very menu the user
		// just opened, mid-open, corrupting the shared modal stack. Skip
		// the rebuild while a menu is open; the real focus change (if any)
		// will be reflected once the menu closes.
		if (this._isShowingMenu)
			return;

		// Closing an open menu (in removeAll) pops a modal grab, which can
		// synchronously re-trigger notify::focus-window before this call
		// unwinds. Re-entering here would operate on actors we're already
		// mid-destroying, corrupting the shared modal stack. Defer the
		// re-entrant call to the next idle instead.
		if (this._switchingWindow) {
			this._pendingWindowSwitch = true;
			return;
		}
		this._switchingWindow = true;

		this.removeAll();
		this._restoreLabel();
		this._hideMenu();
		const overview = Main.overview.visibleTarget;
		const focusApp = WinTracker.focus_app || Main.panel.statusArea.appMenu?._targetApp;
		if (focusApp) {
			let windowData = {};
			// TODO does the window matter?
			let win = focusApp.get_windows()[0];
			let appId = focusApp.get_id(); // *.desktop

			this._titleIndicator.setWindow(focusApp, win);

			// Check cache
			let cachedValue = this._cache.get(appId);
			if (cachedValue) {
				this.setMenus(cachedValue);
			}

			// global.log(`app id: ${focusApp.get_id()} win id: ${win.get_id()}`);
			// TODO check pixel-saver extension for others way of obtaining xid
			let xid = '';
			try {
				xid = parseInt(win.get_description().match(/0x[0-9a-f]+/)[0]);
			} catch (e) {}
			windowData['xid'] = String(xid);
			for (let p in win) {
				if (p.startsWith('gtk_') && win[p] != null) {
					windowData[p] = win[p];
				}
			}
			this._proxy.WindowSwitched(windowData);
		} else {
			this._titleIndicator.clear();
		}

		this._switchingWindow = false;
		if (this._pendingWindowSwitch) {
			this._pendingWindowSwitch = false;
			GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
				this._onWindowSwitched();
				return GLib.SOURCE_REMOVE;
			});
		}
	}

	_onOverviewOpened() {
		this._hideMenu();
	}

	_onOverviewClosed() {
		if (this._forceShowMenu && this._menuButtons.length) {
			this._hideAppMenuButton();
			this._showMenu();
		}
	}

	_disconnectAll() {
		// AppSystem.disconnect(this._appStateChangedId);
		// WinTracker.disconnect(this._notifyFocusAppId);
		for (let h of this._panelEvHandlers) {
			Main.panel.disconnect(h);
		}
		global.display.disconnect(this._notifyFocusWinId);
	}

	destroy() {
		this._disconnectAll();
		this.removeAll();
		this._restoreLabel();
		this._titleIndicator.destroy();
	}
};

const ifaceXml = `
<node>
  <interface name="com.gonzaarcr.appmenu">
	<method name="EchoSignal">
	  <arg type="s" direction="in" name="menu"/>
	  <arg type="u" direction="in" name="x"/>
	</method>
	<method name="WindowSwitched">
	  <arg name="win_data" type="a{ss}" direction="in"/>
	</method>

	<signal name="WindowSwitchedSignal">
	  <arg name="win_data" type="a{ss}"/>
	</signal>
	<signal name="MenuActivated">
	  <arg name="menu" type="s"/>
	  <arg name="x" type="u"/>
	</signal>

	<method name="EchoMenuOnOff">
	  <arg name="on" type="b" direction="in"/>
	</method>
	<signal name="MenuOnOff">
	  <arg name="on" type="b"/>
	</signal>

	<method name="SendTopLevelMenus">
	  <arg name="top_level_menus" type="as" direction="in"/>
	</method>
	<signal name="SendTopLevelMenusSignal">
	  <arg name="top_level_menus" type="as"/>
	</signal>


	<method name="RequestWindowActions"/>
	<signal name="RequestWindowActionsSignal"/>

	<method name="ListWindowActions">
	  <arg name="actions" type="as" direction="in"/>
	</method>
	<signal name="ListWindowActionsSignal">
	  <arg name="actions" type="as"/>
	</signal>

	<method name="ActivateWindowAction">
	  <arg name="action" type="s" direction="in"/>
	</method>
	<signal name="ActivateWindowActionSignal">
	  <arg name="action" type="s"/>
	</signal>

	<method name="EchoRequestMenuTree">
	  <arg name="menu" type="s" direction="in"/>
	</method>
	<signal name="RequestMenuTreeSignal">
	  <arg name="menu" type="s"/>
	</signal>

	<method name="EchoSendMenuTree">
	  <arg name="menu" type="s" direction="in"/>
	  <arg name="tree_json" type="s" direction="in"/>
	</method>
	<signal name="SendMenuTreeSignal">
	  <arg name="menu" type="s"/>
	  <arg name="tree_json" type="s"/>
	</signal>

	<method name="EchoActivateMenuItem">
	  <arg name="selection" type="s" direction="in"/>
	</method>
	<signal name="ActivateMenuItemSignal">
	  <arg name="selection" type="s"/>
	</signal>
  </interface>
</node>`;

const TestProxy = Gio.DBusProxy.makeProxyWrapper(ifaceXml);

const BUS_NAME = 'com.gonzaarcr.appmenu';
const BUS_PATH = '/com/gonzaarcr/appmenu';

class MyProxy {
	constructor() {
		this._createProxy();
		this._handlerIds = [];
	}

	async _createProxy() {
		this._proxy = new TestProxy(
			Gio.DBus.session,
			BUS_NAME,
			BUS_PATH,
			this._onProxyReady.bind(this)
		);
		this.listeners = {
			'MenuActivated': [],
			'SendTopLevelMenus': [],
			'MenuOnOff': [],
			'SendMenuTree': []
		}
	}

	async _onProxyReady(result, error) {
		let id = undefined;
		id = this._proxy.connectSignal('SendTopLevelMenus', this._onSendTopLevelMenus.bind(this));
		this._handlerIds.push(id);
		id = this._proxy.connectSignal('RequestWindowActionsSignal', this._onRequestWindowActionsSignal.bind(this));
		this._handlerIds.push(id);
		id = this._proxy.connectSignal('ActivateWindowActionSignal', this._onActivateWindowActionSignal.bind(this));
		this._handlerIds.push(id);
		id = this._proxy.connectSignal('MenuOnOff', this._onMenuOnOff.bind(this));
		this._handlerIds.push(id);
		id = this._proxy.connectSignal('SendMenuTreeSignal', this._onSendMenuTree.bind(this));
		this._handlerIds.push(id);
	}

	async _onMenuActivated(proxy, nameOwner, args) {
		global.log(`TestSignal: ${args[0]}`);
	}

	async _onSendTopLevelMenus(proxy, nameOwner, args) {
		let topLevelMenus = args[0];
		for (let callback of this.listeners['SendTopLevelMenus']) {
			callback(topLevelMenus);
		}
	}

	async _onRequestWindowActionsSignal(proxy, nameOwner, args) {
		this._currentWindow = new WindowActions();
		let actions = this._currentWindow.getActions();
		this._proxy.ListWindowActionsRemote(actions);
	}

	async _onActivateWindowActionSignal(proxy, nameOwner, args) {
		this._currentWindow._doAction(args[0]);
	}

	async _onMenuOnOff(proxy, nameOwner, args) {
		for (let callback of this.listeners['MenuOnOff']) {
			callback(args[0]);
		}
	}

	async _onSendMenuTree(proxy, nameOwner, args) {
		let menu = args[0];
		let treeJson = args[1];
		for (let callback of this.listeners['SendMenuTree']) {
			callback(menu, treeJson);
		}
	}

	_onNameOwnerChanged(proxy, sender, [name, oldOwner, newOwner]) {
		global.log(`${name} ${oldOwner} ${newOwner}`)
	}

	async WindowSwitched(windowData) {
		this._proxy.WindowSwitchedRemote(windowData);
	}

	async EchoSignal(menu, x) {
		this._proxy.EchoSignalRemote(menu, x);
	}

	async RequestMenuTree(menu) {
		this._proxy.EchoRequestMenuTreeRemote(menu);
	}

	async ActivateMenuItem(selection) {
		this._proxy.EchoActivateMenuItemRemote(selection);
	}

	destroy() {
		for (let id of this._handlerIds) {
			this._proxy.disconnectSignal(id);
		}
		this._handlerIds = [];
	}
};


class Extension {
	constructor(settings) {
		this.settings = settings;
		this._handlerIds = [];
		this.myProxy = new MyProxy();
		this.menubar = new MenuBar(this.myProxy, this);

		this._connectSettings();
	}

	_connectSettings() {
		this._handlerIds.push(this.settings.connect(
			'changed::show-only-when-hover',
			() => { this.menubar.setForceShowMenu(); }
		));
		this._handlerIds.push(this.settings.connect(
			'changed::hide-app-menu',
			() => { this.menubar.setHideAppMenuButton(); }
		));
		for (let key of ['title-show-icon', 'title-show-app-name', 'title-show-window-title', 'title-icon-size']) {
			this._handlerIds.push(this.settings.connect(
				`changed::${key}`,
				() => { this.menubar._titleIndicator.applySettings(); }
			));
		}
	}

	destroy() {
		this._disconnectSettings();

		this.menubar.destroy();
		this.myProxy.destroy();
	}

	_disconnectSettings() {
		for (let h of this._handlerIds) {
			this.settings.disconnect(h);
		}
	}
}


let extension;

export default class FildemMenuExtension extends GExtension {
	enable() {
		let settings = new Settings(this, this.metadata['settings-schema']);
		extension = new Extension(settings);
	}

	disable() {
		extension.destroy();
		extension = null;
	}
}