const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connectDB() {
if (!client) {
if (!process.env.MONGODB_URI) {
throw new Error("MONGODB_URI not defined in environment variables");
}

```
client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

db = client.db("medmind"); // you can change DB name if needed

console.log("✅ MongoDB connected");
```

}

return db;
}

async function getCollection(name) {
const database = await connectDB();
return database.collection(name);
}

module.exports = { getCollection };
