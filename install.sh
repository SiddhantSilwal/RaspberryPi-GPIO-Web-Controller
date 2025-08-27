# Installation Script for Raspberry Pi GPIO Web Controller

#!/bin/bash
IP=$(hostname -I | awk '{print $1}')
Prt=5000
PYTHON_SCRIPT="/usr/share/RaspiWebGPIO/app.py"
SERVICE_NAME="raspiwebGPIO"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo $(cd)
main()
{
    printf "Welcome to\033[1;34m Raspi Web GPIO installer \033[0m \n"
    printf "\033[1mDo you want to Install or Uninstall?\n [I]install \n [u]uninstall\033[0m \n" 
    read choice
    case $choice in
        i ) instl; ;;
        u ) unstl; ;;
        I ) instl; ;;
        install ) instl; ;;
        uninstall ) unstl; ;;
        "") instl; ;;
        * ) echo "Error: Invalid Option"; break;;
    esac
    cd
}

instl()
{
    sudo apt update && sudo apt upgrade
    sudo apt install python3 python3-flask git
    sudo mkdir /usr/share/RaspiWebGPIO
    sudo cp -r AppData/* /usr/share/RaspiWebGPIO
    chmod +x /usr/share/RaspiWebGPIO/app.py
    sudo ufw allow 5000

    printf "\033[1mDo you want to autostart on boot? [Y]yes [n]no\033[0m \n" 
    read $option
    case $option in
        y) autostart; ;;
        n) create_alias; ;;
        yes) autostart; ;;
        no) create_alias; ;;
        "") autostart; ;;
        * ) echo "Error: Invalid Option"; break;;
    esac
    printf "\033[1;32mInstallation of Raspi-Web-GPIO-Controller completed successfully\033[0m \n"
    printf "\033[1;32mApplication files saved at /usr/share/RaspiWebGPIO\033[0m \n"
    printf "\033[1;32mServer hosted at:\033[0m"
    echo "http://${IP}:${Prt}"
}

autostart()
{
    cd
    echo "[Unit]
    Description=Autostart Python Script - $SERVICE_NAME
    After=network.target

    [Service]
    ExecStart=/usr/bin/python3 $PYTHON_SCRIPT
    Restart=always
    User=root
    WorkingDirectory=$(dirname "$PYTHON_SCRIPT")

    [Install]
    WantedBy=multi-user.target
    " | sudo tee "$SERVICE_FILE" > /dev/null

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME".service
    sudo systemctl start "$SERVICE_NAME".service
    create_alias
    echo "Service '$SERVICE_NAME' created and enabled."
    
}

create_alias() {
    chmod +x /usr/share/RaspiWebGPIO/app.py
    local ALIAS_NAME="rwgpio"
    local SCRIPT_PATH="$PYTHON_SCRIPT"
    echo "alias $ALIAS_NAME='python3 \"$SCRIPT_PATH\"'" >> ~/.bashrc
    printf "Alias '$ALIAS_NAME' created. Type \033[1;32m'$ALIAS_NAME'\033[0m to run the script."
}

unstl()
{
    cd
    sudo rm -rf /usr/share/RaspiWebGPIO
    sudo systemctl disable "$SERVICE_NAME".service
    sudo systemctl stop "$SERVICE_NAME".service
    sudo rm -f "$SERVICE_FILE"
    printf "\033[1;32mRaspi-Web-GPIO-Controller uninstalled successfully \033[0m \n"

}

main