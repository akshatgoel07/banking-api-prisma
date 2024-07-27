const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return res.status(401).json({ error: "No token provided" });
		}
		const token = authHeader.split(" ")[1];
		if (!token) {
			return res.status(401).json({ error: "Invalid token format" });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
			select: { id: true, username: true },
		});

		if (!user) {
			return res.status(401).json({ error: "User not found" });
		}

		req.user = user;

		next();
	} catch (error) {
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({ error: "Invalid token" });
		}
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({ error: "Token expired" });
		}
		console.error("Auth middleware error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

module.exports = authMiddleware;
