<template>
  <v-app>
    <v-main>
      <v-toolbar>
        <v-toolbar-title>
          <span>HeartRate</span>
          <span
            v-if="!$vuetify.breakpoint.smAndDown"
            class="font-weight-light ml-1"
            >Graph</span
          >
        </v-toolbar-title>
        <v-btn
          class="ml-4"
          rounded
          text
          :disabled="!isBluetoothAvailable()"
          @click="connect"
        >
          Connect
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn text rounded v-if="!!installPrompt" @click="installPWA">
          <v-icon>mdi-download</v-icon>Install
        </v-btn>
        <v-btn
          v-if="!$vuetify.breakpoint.smAndDown"
          rounded
          text
          href="https://github.com/henkelmax/heartrate-graph"
          target="_blank"
        >
          <v-icon class="mr-2">mdi-open-in-new</v-icon>GitHub
        </v-btn>
      </v-toolbar>

      <v-row v-if="chartData.length <= 1" justify="center" class="ma-2">
        <v-col xl="6" lg="6" md="6" sm="12" cols="12">
          <v-alert
            v-if="isBluetoothAvailable()"
            border="top"
            colored-border
            type="info"
            elevation="2"
            cols="6"
          >
            You need to connect to a heart rate monitor in order to receive
            data. Press the 'Connect' button to scan for Bluetooth devices.
          </v-alert>
          <v-alert
            v-else
            border="top"
            colored-border
            type="error"
            elevation="2"
          >
            Your browser is not able to connect with Bluetooth devices!
          </v-alert>
        </v-col>
      </v-row>

      <GChart
        v-else
        class="chart mt-4"
        type="LineChart"
        :data="chartData"
        :options="chartOptions"
        fill-height
      />

      <v-snackbar v-model="snackbar">
        {{ text }}
        <template v-slot:action="{ attrs }">
          <v-btn color="pink" text v-bind="attrs" @click="snackbar = false">
            Close
          </v-btn>
        </template>
      </v-snackbar>
    </v-main>
  </v-app>
</template>

<script>
import moment from "moment";

export default {
  name: "App",
  data: () => ({
    snackbar: false,
    text: "",
    bufferSize: 60,
    chartData: [["Time", "Heart Rate"]],
    chartOptions: {
      curveType: "function",
      vAxis: { viewWindow: { min: 0 } },
    },
    characteristic: null,
    installPrompt: null,
  }),
  beforeCreate() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.installPrompt = e;
    });
  },
  created() {
    const urlParams = new URLSearchParams(window.location.search);
    const size = Number.parseInt(urlParams.get("bufferSize"));
    if (Number.isInteger(size)) {
      this.bufferSize = size;
    }
  },
  methods: {
    isBluetoothAvailable() {
      return !!navigator.bluetooth?.getAvailability();
    },
    connect() {
      if (this.characteristic) {
        this.characteristic.stopNotifications();
      }

      navigator.bluetooth
        .requestDevice({ filters: [{ services: ["heart_rate"] }] })
        .then((device) => device.gatt.connect())
        .then((server) => server.getPrimaryService("heart_rate"))
        .then((service) => service.getCharacteristic("heart_rate_measurement"))
        .then((characteristic) => characteristic.startNotifications())
        .then((characteristic) => {
          this.characteristic = characteristic;
          characteristic.addEventListener(
            "characteristicvaluechanged",
            this.onValueChanged
          );
        })
        .catch((error) => {
          console.error(error);
          this.text = error.message;
          this.snackbar = true;
        });
    },
    parseHeartRate(value) {
      value = value.buffer ? value : new DataView(value);
      let flags = value.getUint8(0);
      let rate16Bits = flags & 0x1;
      let result = {};
      let index = 1;
      if (rate16Bits) {
        result.heartRate = value.getUint16(index, true);
        index += 2;
      } else {
        result.heartRate = value.getUint8(index);
        index += 1;
      }
      let contactDetected = flags & 0x2;
      let contactSensorPresent = flags & 0x4;
      if (contactSensorPresent) {
        result.contactDetected = !!contactDetected;
      }
      let energyPresent = flags & 0x8;
      if (energyPresent) {
        result.energyExpended = value.getUint16(index, true);
        index += 2;
      }
      let rrIntervalPresent = flags & 0x10;
      if (rrIntervalPresent) {
        let rrIntervals = [];
        for (; index + 1 < value.byteLength; index += 2) {
          rrIntervals.push(value.getUint16(index, true));
        }
        result.rrIntervals = rrIntervals;
      }
      return result;
    },
    onValueChanged(event) {
      const heartRate = this.parseHeartRate(event.target.value).heartRate;
      this.addValue(heartRate);
    },
    addValue(heartRate) {
      this.chartData.push([moment().format("HH:mm:ss"), heartRate]);
      if (this.bufferSize > 0) {
        while (this.chartData.length > this.bufferSize + 1) {
          this.chartData.splice(1, 1);
        }
      }
    },
    installPWA() {
      if (!this.installPrompt) {
        return;
      }
      this.installPrompt.prompt();
      this.installPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          this.installPrompt = null;
        }
      });
    },
  },
};
</script>

<style>
.chart {
  height: 70%;
}
</style>