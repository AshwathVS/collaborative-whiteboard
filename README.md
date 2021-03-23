# Collaborative Whiteboard
A basic collaborative whiteboard which saves the data in memory. It uses a modified version of PAXOS for distributed consensus.

The first person to join a room will become the leader, and when a leader exits a room, PAXOS will be used to elect the next leader for that room. Other members will need to request edit access from the leader and only authorised members can persist the whiteboard data.

The application uses NODE.js, socket.js and is also available as a docker image.
