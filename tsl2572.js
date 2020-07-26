module.exports = function (RED) {
  const tsl2572 = require("./tsl2572lib");
  function TSL2572Node(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.device = +config.address;
    node.integ = +config.integ;
    node.gain = +config.gain;

    node.on("input", function (msg) {
      this.status({ fill: "green", shape: "dot", text: "start" });
      tsl2572(node.device, node.integ, node.gain, (err, value) => {
        if (!err) {
          msg.payload = value;
          node.send(msg);
          this.status({
            fill: "green",
            shape: "dot",
            text: `${Math.round(value.lux * 10) / 10}(lux)`,
          });
        } else {
          this.status({ fill: "green", shape: "dot", text: "error" });
          node.error();
        }
      });
    });
  }
  RED.nodes.registerType("tsl2572", TSL2572Node);
};
