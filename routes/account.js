const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware");

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get("/balance", async (req, res) => {
	const userId = req.user.id;

	try {
		const account = await prisma.account.findFirst({
			where: { userId },
		});

		if (!account) {
			return res.status(404).json({ error: "Account not found" });
		}

		res.json({ balance: account.balance });
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
});

router.post("/history", async (req, res) => {
	const userId = req.user.id;

	try {
		const transactions = await prisma.transaction.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		res.json(transactions);
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
});

router.post("/deposit", async (req, res) => {
	const userId = req.user.id;
	const { amount } = req.body;

	if (amount <= 0) {
		return res.status(400).json({ error: "Invalid amount" });
	}

	try {
		const result = await prisma.$transaction(async (prisma) => {
			const account = await prisma.account.findFirst({
				where: { userId },
			});

			if (!account) {
				throw new Error("Account not found");
			}

			const updatedAccount = await prisma.account.update({
				where: { id: account.id },
				data: { balance: { increment: amount } },
			});

			const transaction = await prisma.transaction.create({
				data: {
					userId,
					accountId: account.id,
					amount,
					type: "CREDIT",
				},
			});

			return { updatedAccount, transaction };
		});

		res.json({
			message: "Deposit successful",
			newBalance: result.updatedAccount.balance,
			transaction: result.transaction,
		});
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
});

router.post("/withdraw", async (req, res) => {
	const userId = req.user.id;
	const { amount } = req.body;

	if (amount <= 0) {
		return res.status(400).json({ error: "Invalid amount" });
	}

	try {
		const result = await prisma.$transaction(async (prisma) => {
			const account = await prisma.account.findFirst({
				where: { userId },
			});

			if (!account) {
				throw new Error("Account not found");
			}

			if (account.balance < amount) {
				throw new Error("Insufficient funds");
			}

			const updatedAccount = await prisma.account.update({
				where: { id: account.id },
				data: { balance: { decrement: amount } },
			});

			const transaction = await prisma.transaction.create({
				data: {
					userId,
					accountId: account.id,
					amount: -amount,
					type: "DEBIT",
				},
			});

			return { updatedAccount, transaction };
		});

		res.json({
			message: "Withdrawal successful",
			newBalance: result.updatedAccount.balance,
			transaction: result.transaction,
		});
	} catch (error) {
		if (error.message === "Insufficient funds") {
			res.status(400).json({ error: error.message });
		} else {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

module.exports = router;
