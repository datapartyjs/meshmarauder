# mesh marauder

 * Documentation - [meshmarauder.net](https://meshmarauder.net)
 * Code - [github.com/datapartyjs/meshmarauder](https://github.com/datapartyjs/meshmarauder)
 * Support - [ko-fi/nullagent](https://ko-fi.com/nullagent)

Features

 - packet capture
   * single channel
   * scanning
   * multiple devices (coming soon)
 - packet decoding
   * protocol header
   * unencrypted packets
   * encrypted symmetric channel messages
   * encrypted asymmetric DM messages (coming soon)
 - PKI poisoning
 - User profile tampering
 - public channel impersonation (coming soon)
 - MITM private messages (coming soon)
 - Location spoofing (coming soon)
 - Webapp (coming soon)

## Join the fun

 * Flash [lorapipe](https://github.com/datapartyjs/lorapipe/) to your favorite lora mesh device
 * Install this repo
 * Run `./lora-scanner.sh` to listen for lora traffic
 * Run `./meshmarauder.sh` to start marauding (coming soon)

## Installing

You must install using this command:

`npx jsr add @meshtastic/protobufs`

If you use `npm i` it probably won't install.

## Disclaimer

This is a demonstration for DEFCON 33 and not recommended to be used on public default meshes.

## Follow & Support

 * Support - [ko-fi.com/nullagent](https://ko-fi.com/nullagent)
 * Follow - [partyon.xyz/@nullagent](https://partyon.xyz/@nullagent)

## Example


`./bin/lora-scanner -D /dev/tty_lorapipe0 -p 917.25,500,7,8,2b | ./bin/lora-decoder`
