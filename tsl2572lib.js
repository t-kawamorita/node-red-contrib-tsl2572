const i2c = require("i2c-bus");
const i2cbus = i2c.openSync(1);
const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

async function readBlock(address, command, length) {
  return new Promise((resolve, reject) => {
    i2cbus.readI2cBlock(
      address,
      command,
      length,
      new Buffer(length),
      (err, bytesRead, buffer) => {
        if (err) {
          return reject(err);
        }
        resolve({
          bytesRead: bytesRead,
          buffer: buffer,
        });
      }
    );
  });
}

async function writeBlock(address, command, data) {
  const buffer = new Buffer(data.length);
  for (let n = 0; n < data.length; n++) {
    buffer[n] = data[n];
  }
  return new Promise((resolve, reject) => {
    i2cbus.writeI2cBlock(address, command, buffer.length, buffer, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(1);
    });
  });
}

async function write(device, address, byte) {
  await writeBlock(device, 0x80 + address, [byte]);
}

async function read(device, adr, length) {
  const ret = await readBlock(device, 0x80 + adr, length);
  const buf = [];
  for (let n = 0; n < length; n++) {
    buf.push(0 + ret.buffer[n]);
  }
  return buf;
}

async function dump() {
  console.log(await read(0, 32));
}

async function setGain(device, gain) {
  if (gain === 0.16) {
    await write(device, 0x0d, 4);
    await write(device, 0x0f, 0);
  } else if (gain === 1) {
    await write(device, 0x0d, 0);
    await write(device, 0x0f, 0);
  } else if (gain === 8) {
    await write(device, 0x0d, 0);
    await write(device, 0x0f, 1);
  } else if (gain === 16) {
    await write(device, 0x0d, 0);
    await write(device, 0x0f, 2);
  } else {
    // === 120
    await write(device, 0x0d, 0);
    await write(device, 0x0f, 3);
  }
  return gain;
}

async function setInteg(device, integ) {
  if (integ === 50) {
    await write(device, 0x01, 0xed);
  } else if (integ === 200) {
    await write(device, 0x01, 0xb6);
  } else {
    await write(device, 0x01, 0x24);
  }
}

async function measure(device, integ, gain) {
  let gains = [0.16, 1, 8, 16, 120];
  let integs = [50, 200, 600];

  gain = gains.indexOf(gain) === -1 ? 8 : gain;
  integ = integs.indexOf(integ) === -1 ? 200 : integ;

  await write(device, 0x00, 0x01); // STOP ALS

  setGain(device, gain);
  setInteg(device, integ);

  await write(device, 0x00, 0x03); // START ALS

  for (let num = 0; num < 100; num++) {
    await sleep(10);
    const status = read(device, 0x13, 1);
    if ((status[0] & 0x11) === 0x11) {
      break;
    }
  }
  await write(device, 0x00, 0x01); // STOP ALS
  await write(device, 0x00, 0x00); // SLEEP

  // results
  const result = await read(device, 0x14, 4);
  const ch0 = (result[1] << 8) + result[0];
  const ch1 = (result[3] << 8) + result[2];

  const cpl = (integ * gain) / 60;
  const lux1 = (1.0 * ch0 - 1.87 * ch1) / cpl;
  const lux2 = (0.63 * ch0 - 1.0 * ch1) / cpl;
  const lux = Math.max(0, lux1, lux2);
  return {
    lux: lux,
    ch0: `0x${(+ch0).toString(16)}`,
    ch1: `0x${(+ch1).toString(16)}`,
    gain: gain,
    integ: integ,
  };
}

function measure2572(device, integ, gain, callback) {
  measure(device, integ, gain).then(
    (value) => {
      callback(null, value);
    },
    (error) => {
      callback("error");
    }
  );
}

module.exports = measure2572;
