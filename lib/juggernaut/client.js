var util     = require("util");
var Channel = require("./channel");
var Events  = require("./events");

Client = module.exports = require("./klass").create();

Client.include({
  init: function(conn){
    this.connection = conn;
    this.session_id = this.connection.session_id;
  },

  setMeta: function(value){
    this.meta = value;
    util.log("Setting client meta to: " + value);
  },

  event: function(data){
    Events.custom(this, data);
  },

  roster: function(){
    data = {}
    if ( this.meta.friend_channels == undefined ) return;
    for(var i=0, len = this.meta.friend_channels.length; i < len; i++) {
      var channel = this.meta.friend_channels[i];
      var status = Channel.find(channel).status();
      data[channel] = status;
    }
    return data;
  },

  subscribe: function(name){
    this.name = name;
    util.log("Client subscribing to: " + name);
    var channel = Channel.find(name)
    channel.subscribe(this);
  },

  unsubscribe: function(name){
    util.log("Client unsubscribing from: " + name);
    var channel = Channel.find(name);
    channel.unsubscribe(this);
  },

  write: function(message){
    if (message.except) {
      var except = Array.makeArray(message.except);
      if (except.include(this.session_id))
        return false;
    }

    this.connection.write(message);
  },

  disconnect: function(){
    // Unsubscribe from all channels
    Channel.unsubscribe(this);
  }
});