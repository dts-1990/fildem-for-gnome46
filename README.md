# Fildem Global Menu (on Panel) for GNOME 46

This is a fork/updated version of the Fildem Global Menu, patched to work with modern Python versions (3.12+) and GNOME 46.

Example:
![Fildem](https://user-images.githubusercontent.com/19943481/95288612-1d272a80-083f-11eb-9400-be88f61e054d.png)

## Prerequisites

### 1. Install System Dependencies
Install the required libraries for menu exporting and keybinding.

**Zorin OS/Ubuntu/Debian/Mint:**
```bash
sudo apt install bamfdaemon gir1.2-bamf-3 libbamf3-2 libkeybinder-3.0-0 gir1.2-keybinder-3.0 appmenu-gtk2-module appmenu-gtk3-module unity-gtk-module-common python3-pip git
```

### 2. Install Python Dependencies
Modern systems require a few specific python packages. Note the use of `--break-system-packages` if you are on a managed distribution like Ubuntu 24.04+, otherwise you can omit it.

```bash
sudo pip install future fuzzysearch --break-system-packages
```

## Installation

### 1. Install the Fildem Backend
Navigate to this directory in your terminal and install the python module.

```bash
cd ~/codes/fildem-for-gnome46
sudo pip install . --break-system-packages
```

### 2. Install the GNOME Shell Extension
Copy the extension folder to your local extensions directory.

```bash
rm -rf ~/.local/share/gnome-shell/extensions/fildemGMenu@gonza.com
cp -r fildemGMenu@gonza.com ~/.local/share/gnome-shell/extensions/
```

After copying, **Log Out and Log Back In** (on X11 you can press `Alt+F2`, type `r`, and enter).
Then enable the extension:
```bash
gnome-extensions enable fildemGMenu@gonza.com
```

## Configuration (Required)

For the global menu to actually appear, applications must be told to export their menus.

### 1. GTK 3 Configuration
Create or edit `~/.config/gtk-3.0/settings.ini`:

```bash
mkdir -p ~/.config/gtk-3.0
printf "[Settings]\ngtk-modules=appmenu-gtk-module\n" > ~/.config/gtk-3.0/settings.ini
```
*Note: If you already have a `[Settings]` section in that file, just add the `gtk-modules` line under it.*

### 2. GTK 2 Configuration (Legacy)
Create or edit `~/.gtkrc-2.0`:

```bash
echo 'gtk-modules="appmenu-gtk-module"' >> ~/.gtkrc-2.0
```

## Running & Autostart

The menu requires a background service (`fildem`) to be running.

### 1. Test it manually
Run this in a terminal:
```bash
fildem
```
It should "hang" (show no output). Open a new application (like Text Editor or Files) and check if the menu appears in the top bar.

### 2. Enable Autostart
To make `fildem` start automatically when you log in, create a desktop entry:

```bash
mkdir -p ~/.config/autostart
cat <<EOF > ~/.config/autostart/fildem.desktop
[Desktop Entry]
Type=Application
Exec=fildem
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Fildem Global Menu
Comment=Run Fildem backend
EOF
```

## State of the Apps

To see a list of apps that work check [the wiki](https://github.com/gonzaarcr/Fildem/wiki/Using#state-of-the-apps)

## Troubleshooting

*   **Menu not showing?**
    Ensure `fildem` is running:
    ```bash
    ps aux | grep fildem
    ```
*   **App not showing menu?**
    Some apps need to be restarted *after* the configuration files are created. A full full Log Out/Log In is recommended.

