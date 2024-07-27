const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();
const prisma = new PrismaClient();

router.post("/signup", async (req, res) => {
	const { username, password, firstName, lastName } = req.body;

	try {
		const existingUser = await prisma.user.findUnique({
			where: { username },
		});

		if (existingUser) {
			return res.status(411).json({ message: "User already exists" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		console.log("user data:", {
			username,
			firstName,
			lastName,
			password: hashedPassword,
		});

		const user = await prisma.user.create({
			data: {
				username,
				firstName,
				lastName,
				password: hashedPassword,
				accounts: {
					create: {
						balance: 10000,
					},
				},
			},
		});

		if (!user || !user.id) {
			throw new Error("Failed to create user");
		}
		console.log("User created:", user);

		const token = jwt.sign({ userId: user.id }, JWT_SECRET);

		res.status(201).json({
			message: "User created successfully",
			token: token,
		});
	} catch (error) {
		console.error("Error in signup:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

router.post("/signin", async (req, res) => {
	const { username, password } = req.body;

	try {
		const user = await prisma.user.findUnique({ where: { username } });

		if (!user || !(await bcrypt.compare(password, user.password))) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
			expiresIn: "1h",
		});
		res.json({ token });
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
});

module.exports = router;
