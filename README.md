# JS Game Downloader

For every new game I was creating an "installer script" (this one too!) and it was knulli specific and it was going to be a nightmare to make different versions for every OS for every game. I decided to consolidate!

And the best part is you can make a PR and add your own game! You just need a game name, github repo, and an image if you want. Eventually we will require git hashes but for now it can just point directly to main.

## Contributing

- This is very much a work in progress. And rushed to together to get it done for the hackathon on March 1st 2025. It likely will only work with just knulli since we make many assumptions about the file system and the way the roms are stored.

- THAT SAID . . . . just add your game to public/registry.json, add an icond to public/images, and submit a PR! This insstaller is meant to go and grab a list from github but fall back on the local list if none are found.

## Installing on [Knulli](https://knulli.org/) or [Batocera](https://batocera.org/)

These are meant to be used with the [jsgamelauncher](https://github.com/monteslu/jsgamelauncher). Install that first using the curl command and then use a similar curl command to install this game.

NOTE! You need to run the 'Update Gamelists' Knulli/Batocera option to get the game to show up.<br>
NOTE! This script assumes your roms are stored in /userdata/roms on the root device.<br>
NOTE! This script will also delete and replace any game called "SlideGame" in /userdata/roms/jsgames that have matching names.<br>

- Make sure wifi is turned on for your Knulli device or you are otherwise connected to the internet on a Batocera device
- `ssh root@<myDevice>` (default password: linux, default device name : KNULLI or BATOCERA, use IP from device or <myDevice>.local if name fails)
- `curl -o- https://raw.githubusercontent.com/tooshel/jsgamedownloader/main/installers/install-batocera-knulli.sh | bash`
