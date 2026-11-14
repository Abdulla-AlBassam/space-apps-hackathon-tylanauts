# Device hub

How our app takes in data from many wearables and combines it. Agreed with
Abdulla on 14 Nov 2026. If something here is wrong, change it in a pull request.

## The idea

Any wearable an astronaut has on (a watch, a chest strap, a headband) sends its
readings to our hub, and we combine them into one picture of their health. One
device on its own sees part of the body; several together let us cross-check
readings and spot patterns no single device can.

For the demo every device is **simulated**, but the simulated devices send their
data to **real webhook addresses on a small server**, so the data really flows
through the hub the way real devices would.

## How data gets in

```
Watch        -> POST /api/ingest/watch        -> watch adapter       \
Chest strap  -> POST /api/ingest/chest-strap  -> chest strap adapter  -> common readings -> combine, score -> dashboard
Headband     -> POST /api/ingest/headband     -> headband adapter    /
```

1. **A device sends a message** to its own address (a "webhook"). Real devices
   all send data in different shapes, which is why each type gets its own address.
2. **An adapter converts it.** Each address has a small piece of code that knows
   that device's shape and turns it into our common readings. A new kind of
   device later means one new address and adapter; nothing else changes.
3. **The hub stores readings**, all in the same format.
4. **The analysis combines them**, grouped by astronaut and time.
5. **The dashboard shows the result**, with a label saying which device each
   number came from.

### The common format (one row per measurement)

| Field | Example | What it is |
| --- | --- | --- |
| `astronaut_id` | `crew-01` | Who it belongs to |
| `device_id` | `watch-7F3A` | Which exact device sent it |
| `device_type` | `watch` | `watch`, `chest-strap`, `headband`, ... |
| `metric` | `heart_rate` | What was measured |
| `value` | `58` | The number |
| `unit` | `bpm` | The unit |
| `time` | `2026-11-14T06:00:00Z` | When it was measured (UTC) |
| `quality` | `good` | Whether the reading can be trusted (e.g. `poor` if the wearer was moving) |

### Simulated devices

A small script pretends to be each device and sends messages to the webhook
addresses on a timer, following a 30-day mission storyline (for example a few
nights of bad sleep around day 12, so the alerts have something to catch).

### The smart shirt (based on a real space agency device)

The **Smart shirt** on the Devices page is modelled on **Bio-Monitor**, a smart shirt,
headband and tablet app that the Canadian Space Agency (CSA) sent to the International
Space Station in December 2018. CSA astronaut David Saint-Jacques was the first to try it
in space. It was developed for the CSA by Carré Technologies of Montreal, whose commercial
version is called Hexoskin. News coverage at the time also called the shirt "Astroskin".

What the CSA says Bio-Monitor records: pulse and the heart's electrical activity (ECG),
blood pressure, breathing rate and volume, skin temperature, blood oxygen, and physical
activity. It can be worn while sleeping and exercising. After use, the astronaut docks the
battery pack on a base, which sends the data down to Earth.

In our app the shirt is a made-up copy (always tagged "Sample data") and feeds two health
categories:

- **Heart:** blood pressure (it replaces the daily typed-in reading) and heart rhythm (ECG).
- **Sleep:** breathing depth while asleep.

It does not feed Mind & mood or Radiation, because it doesn't measure those.

Sources:
- Canadian Space Agency, "Bio-Monitor: Keeping an eye on astronauts' vital signs":
  https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp
- Space.com, "Astronaut Suits Up in 'Smart' Astroskin Jersey on Space Station":
  https://www.space.com/43228-astroskin-smart-space-jersey-for-astronauts.html

We use no CSA logo or branding, only a text credit.

### When two devices measure the same thing

A priority list picks the more trustworthy device (for example: heart rate from
the chest strap if it is worn, otherwise from the watch), and the dashboard shows
which one was used. Health logic owns this list.

## What combining devices lets us see

These come from general knowledge and still need sources (see the Issues)
before they go in the pitch. Present the speculative ones as ideas, not proven
science.

| Combination | Devices | What it gives us | How sure |
| --- | --- | --- | --- |
| Use the most accurate device for each measurement | Chest strap + watch | Chest straps measure heart rhythm electrically (ECG), which is more accurate than a wrist's light sensor, especially during exercise | Well established |
| Throw out readings taken while moving | Watch motion sensor + any heart sensor | Wrist heart readings are less reliable when the arm is moving, so movement data can flag them as poor quality | Well established |
| Better sleep stages | Headband + watch | Sleep stages are defined from brain waves (EEG); a headband measures those, a watch only estimates | Well established (consumer headband accuracy varies) |
| Poor sleep shows up in next-day recovery | Headband sleep + chest strap HRV and resting heart rate | Links a bad night to a lower Recovery score the next morning, and explains why | Some evidence |
| Early warning of getting ill | Watch skin temperature + resting heart rate + HRV | Several signals drifting together can appear before symptoms | Some evidence, not clinically proven |
| Stress and mood | Daily check-in + sleep + HRV | A run of low mood plus poor sleep suggests talking to the crew doctor | Speculative |
| Exercise against bone and muscle loss | Chest strap + watch exercise load | Tracks whether the astronaut exercises enough; a wearable cannot measure bone directly | Speculative as a bone measure |

**In the MVP:** the first three, plus "poor sleep shows up in next-day recovery".

## Connect a device (mock walkthrough)

Opened from an "Add device" button. Nothing really connects: every step has a
Next button, and the fake waits last about two seconds. A progress bar (step 2 of
6) and a Back button on every screen.

1. **Choose a device type.** Cards: Watch, Chest strap, Headband, and a greyed-out
   "More coming". Each card lists what that device measures.
2. **Get it ready.** "Charge it and turn it on. Hold the button until the light flashes."
3. **Searching.** A spinner, then one found device, e.g. "Watch · serial 7F3A".
4. **Choose what to share.** Ticked boxes per measurement (heart rate, HRV, skin
   temperature, sleep, movement).
5. **Test reading.** A live-looking heart rate and a "Signal: good" badge.
6. **Done.** Name it ("Left wrist watch"), then "Go to My devices".

Finishing adds the device to that astronaut's list.

## My devices page

One page per astronaut, with a crew switcher at the top and an "Add device"
button that opens the walkthrough. Each device is a card showing:

- name and type, with an icon ("Left wrist watch · Watch")
- status: Connected, or "Last data 3 hours ago" in amber when it has gone quiet
- battery level and signal quality
- what it measures, and what it is the main source for ("Main source for: heart rate")
- buttons: pause sharing, remove

Empty state: "No devices yet. Connect your first one to start seeing your health data."
