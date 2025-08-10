#!/bin/bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git
cd
git clone https://github.com/your/repo.git
cd /RaspberryPi-GPIO-Web-Controller
chmod +x install.sh
source ./install.sh
instl
sudo rm -rf webinstaller.sh
cd
