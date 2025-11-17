// scripts/remove-old-index.js
import mongoose from "mongoose";

// ⚙️ 你的数据库连接字符串
const MONGO_URI =
  "mongodb+srv://kogorou0105_db_user:KY1w2RfBrVpaVx5T@cluster0.helt6vn.mongodb.net/?appName=Cluster0"; // 改成你的数据库

async function removeOldIndex() {
  try {
    // 连接数据库
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("users");

    // 获取当前索引
    const indexes = await collection.indexes();
    console.log("📋 Current indexes:");
    console.table(
      indexes.map((i) => ({ name: i.name, key: i.key, unique: i.unique }))
    );

    // 检查是否存在 username_1
    const hasOldIndex = indexes.some((idx) => idx.name === "username_1");

    if (hasOldIndex) {
      console.log("⚠️  Found old index 'username_1', removing...");
      await collection.dropIndex("username_1");
      console.log("✅ Successfully removed 'username_1' index");
    } else {
      console.log("👍 No 'username_1' index found, nothing to remove");
    }
  } catch (error) {
    console.error("❌ Error while removing index:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

removeOldIndex();
