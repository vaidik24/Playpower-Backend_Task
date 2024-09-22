import { generateToken } from "../config/jwt.js";
import { User } from "../models/user.model.js";

const login = async (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    const token = generateToken({ username });
    const newUser = new User({ username, password });
    await newUser.save();
    return res.json({ token });
  }
  return res.status(400).json({ message: "Username and password required" });
};

export { login };
