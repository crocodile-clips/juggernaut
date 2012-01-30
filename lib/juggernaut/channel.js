var util    = require("util");
var Events = require("./events");
var Message = require("./message");
var redis   = require("./redis");

Channel = module.exports = require("./klass").create();

Channel.extend({
  channels: {},

  find: function(name){
    if ( !this.channels[name] )
      this.channels[name] = Channel.inst(name)
    return this.channels[name];
  },

  publish: function(message){
    var channels = message.getChannels();
    delete message.channels;

    util.log(
      "Publishing to channels: " +
      channels.join(", ") + " : " + message.data
    );

    for(var i=0, len = channels.length; i < len; i++) {
      message.channel = channels[i];
      var clients     = this.find(channels[i]).clients;

      for(var x=0, len2 = clients.length; x < len2; x++) {
        clients[x].write(message);
      }
    }
  },

  unsubscribe: function(client){
    for (var name in this.channels)
      this.channels[name].unsubscribe(client);
  }
});

Channel.include({
  init: function(name){
    this.name    = name;
    this.clients = [];
    this.redis = redis.createClient();
  },

  roster: function(){
    util.log("Got friend_channels: " + this.friend_channels.join(','));
    if ( this.friend_channels == undefined ) return;
    var keys = []
    var friend_channels = this.friend_channels;
    var name = this.name;
    for(var i=0, len = this.friend_channels.length; i < len; i++) {
      var channel = this.friend_channels[i];
      keys.push( "Juggernaut:"+channel+":status" );
    }
    this.redis.mget(keys, function(err, values) {
      var data = {};
      for(var i=0, len = friend_channels.length; i < len; i++) {
        var channel = friend_channels[i];
        data[channel] = values[i] || "false";
      }

      Channel.publish( Message.inst({
        channel: name,
        data: {
          type: "roster",
          roster: data
        }
    }));
    });
  },

  subscribe: function(client){
    if ( this.clients.include(client) ) return;
    this.friend_channels = client.meta.friend_channels;
    this.clients.push(client);
    this.redis.set('Juggernaut:'+this.name+':status','true')
    Channel.publish( Message.inst({
      channels: this.friend_channels,
      data: {
        type: "create",
        sender_id: client.meta.user_id
      }
    }));
    Events.subscribe(this, client);
    this.roster();
  },

  unsubscribe: function(client){
    if ( !this.clients.include(client) ) return;
    this.clients = this.clients.delete(client);
    if ( this.clients.length == 0 ) {
      this.redis.setex('Juggernaut:'+this.name+':status',60,'warm');
      Channel.publish( Message.inst({
        channels: this.friend_channels,
        data: {
          type: "destroy",
          sender_id: client.meta.user_id
        }
      }));
    }
    Events.unsubscribe(this, client);
  }
});
