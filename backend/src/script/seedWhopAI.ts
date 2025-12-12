import "dotenv/config";
import connectDatabase from "../config/database.config";
import UserModel from "../models/user.model";
const createAiUser = async () => {
  let ai = await UserModel.findOne({ isAi: true });
  if (ai) {
    console.log("Ai User have already been created!");
    return ai;
  }
  ai = await UserModel.create({
    name: "whop AI",
    isAi: true,
    avatar: "/whop-ai-logo.svg",
  });
  console.log("Ai User created:", ai._id);
  return ai;
};

const seedAi = async () => {
  try {
    await connectDatabase();
    await createAiUser();
    console.log("seed completed");
    process.exit(0);
  } catch (error) {
    console.log("seed error:", error);
    process.exit(1);
  }
};

seedAi();
