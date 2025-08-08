#!/bin/bash

DEVICE=""
PRESET=()
INTERVAL=60
DEBUG=0

usage() {
    echo "Usage: $0 [-D DEVICE] [-p PRESET]... [-i INTERVAL] [-h]"
    echo
    echo "Options:"
    echo "  -D DEVICE     Serial Device of lorapipe radio (required)"
    echo "  -p PRESET     LoRA Radio Preset String (one or more required)"
    echo "  -i INTERVAL   Interval in seconds between switching between the specified presets (default 60)"
    echo "  -h            Show this help message and exit"
    exit 1
}

error_exit() {
    echo "Error: $1" >&2
    usage
    exit 1
}

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        -D)
            shift
            [[ -z "$1" || "$1" =~ ^- ]] && error_exit "Missing value for -D"
            [[ ! -e "$1" ]] && error_exit "Device '$1' does not exist."
            DEVICE="$1"
            ;;
        -i)
            shift
            [[ -z "$1" || "$1" =~ ^- ]] && error_exit "Missing value for -i"
            [[ ! -n "$1" ]] && error_exit "Interval must be an integer: got '$1'"
            INTERVAL="$1"
            ;;
        -p)
            shift
            [[ -z "$1" || "$1" =~ ^- ]] && error_exit "Missing value for -p"
            PRESET+=("$1")
            ;;
        -h|--help)
            usage
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
    shift
done

# Validate required arguments
if [[ -z "$DEVICE" ]]; then
    error_exit "Device argument was not specified after -D"
fi

if [[ ${#PRESET[@]} -eq 0 ]]; then
    error_exit "At least one -p (preset) value is required."
fi

# Do the thing
exec 3<> "$DEVICE"  # Shove device into a file descriptor

clear_buffer() {
    while true; do
        if read -t 0 -u 3; then
            IFS= read -r -t 1 -u 3 line
            [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] clear_buffer line: ${line}"
        else
            [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] clear_buffer: nothing to read"
            break
        fi
    done
}

send_cmd() {
    clear_buffer
    cmd=$1
    printf "$cmd\r\n" >&3
    [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] command sent: $cmd"

    IFS= read -r -t 1 -u 3 line
    [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] command recieved: $line"

    IFS= read -r -t 1 -u 3 line
    [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] command response: $line"

    return $line
}

change_preset() {
    send_cmd "rxlog off"
    send_cmd "set radio $1"

    timestamp=$(date +%s)
    radio_preset=$(send_cmd "get radio")
    echo "$timestamp,RADIO_PRESET,$radio_preset"

    send_cmd "rxlog on"
}

set_clock() {
    timestamp=$(date +%s)
    send_cmd "clock sync $timestamp"
}

serial_port_loop() {
    clear_buffer
    [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] beginning serial port read loop"
    while IFS= read -r -u 3 line; do
        # read fd3 which is a fh on $DEVICE
        [[ $line =~ ^[0-9]{5}+ ]]; echo "$line"
        [[ $DEBUG -eq 1 && ! $line =~ ^[0-9]{5}+ ]] && echo "[$0] [DEBUG] $line"
        [[ $DEBUG -eq 1 ]] && echo "[$0] [DEBUG] waiting for next line"
    done
}

preset_idx=0
init_scanner() {
    stty -F ${DEVICE} raw
    stty -F ${DEVICE} -echo
    set_clock
    change_preset ${PRESET[0]} # set initial preset
    preset_idx=1 # initialize preset_idx counter to begin on the second value
}

run_periodic_command() {  # Run me every interval!
    # only run if more than one preset specififed
    if [[ ${#PRESET[@]} -gt 1 ]]; then
        change_preset ${PRESET[$preset_idx]}
        # Move to the next value in the array, cycling back to the first value if at the end
        ((preset_idx = (preset_idx + 1) % ${#PRESET[@]}))
    fi
}

cleanup() {
    echo "[$0] killing child processes and exiting"
    kill "$loop_pid" 2>/dev/null
    exit 0
}

trap cleanup EXIT INT # trap exit signals and call cleanup

init_scanner
serial_port_loop & # fork a serial port loop
loop_pid=$! # store the forked processes pid

last_trigger_time=$(date +%s)  # Set start time
while true; do
    now=$(date +%s)
    elapsed=$((now - last_trigger_time))
    if [[ "$elapsed" -ge "$INTERVAL" ]]; then
        kill $loop_pid # kill the reading process
        wait $loop_pid # wait for it to terminate

        run_periodic_command
        last_trigger_time=$now

        serial_port_loop & # fork a serial port loop
        loop_pid=$! # store the forked processes pid
    fi
done