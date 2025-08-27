# Web Installer Script for Raspberry Pi GPIO Web Controller

#!/bin/bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git
cd
sudo git clone https://github.com/SiddhantSilwal/RaspberryPi-GPIO-Web-Controller.git
cd RaspberryPi-GPIO-Web-Controller
sudo chmod +x install.sh
source ./install.sh
instl
cd
cd RaspberryPi-GPIO-Web-Controller
sudo rm -rf webinstaller.sh
cd
