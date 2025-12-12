import mongoose, { Document, Schema } from "mongoose";
import { compareValue, hashValue } from "../utils/bcrypt";

export interface UserDocument extends Document {
  name: string;
  email?: string;
  password?: string;
  avatar?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAi: boolean;
  comparePassword(value: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: function () {
        return !this.isAi;
      },
    },
    password: {
      type: String,
      required: function () {
        return !this.isAi;
      },
    },
    avatar: { type: String, default: null },
    isAi: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (ret) {
          delete (ret as any).password;
        }
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function (next) {
  if (this.password && this.isModified("password")) {
    this.password = await hashValue(this.password);
  }
  next();
});

userSchema.methods.comparePassword = async function (val: string) {
  return compareValue(val, this.password);
};

const UserModel = mongoose.model<UserDocument>("User", userSchema);
export default UserModel;
