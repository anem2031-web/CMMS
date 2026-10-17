import net from "node:net";
net.Socket.prototype.connect = function () { throw new Error("Network/database connection forbidden in isolated material-cost tests"); };
