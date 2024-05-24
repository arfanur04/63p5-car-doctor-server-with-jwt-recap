const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
	cors({
		origin: [
			"http://localhost:5173",
			"https://m58-car-doctor.web.app",
			"https://m58-car-doctor.firebaseapp.com",
		],
		credentials: true,
	})
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zxotz8q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

// middlewares
const logger = (req, res, next) => {
	try {
		console.log("log: info", req.method, req.url);
		next();
	} catch (error) {
		console.error("error: ", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
};

const verifyToken = (req, res, next) => {
	try {
		const token = req?.cookies?.token;
		// console.log('token in the middleware', token);
		// no token available
		if (!token) {
			return res.status(401).send({ message: "unauthorized access" });
		}
		jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
			if (err) {
				return res.status(401).send({ message: "unauthorized access" });
			}
			req.user = decoded;
			next();
		});
	} catch (error) {
		console.error("error: ", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
};

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();

		const serviceCollection = client.db("m58carDoctor").collection("services");
		const bookingCollection = client.db("m58carDoctor").collection("bookings");

		// auth related api
		app.post("/jwt", logger, async (req, res) => {
			try {
				const user = req.body;
				console.log("user for token", user);
				const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
					expiresIn: "1h",
				});

				res
					.cookie("token", token, {
						httpOnly: true,
						secure: true,
						sameSite: "none",
					})
					.send({ success: true });
			} catch (error) {
				console.error("error: ", error);
			}
		});

		app.post("/logout", async (req, res) => {
			try {
				const user = req.body;
				console.log("logging out", user);
				res.clearCookie("token", { maxAge: 0 }).send({ success: true });
			} catch (error) {
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		// services related api
		app.get("/services", async (req, res) => {
			try {
				const filter = req.query;
				console.log(`filter:`, filter);
				const sort = filter.sort;
				const min = +filter.min;
				const max = +filter.max;
				const query = {
					price: { $gt: min, $lt: max },
				};
				const options = {
					sort: {
						price: sort === "asc" ? 1 : -1,
					},
				};
				const cursor = serviceCollection.find(query, options);
				const result = await cursor.toArray();
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		// app.get("/temp", logger, async (req, res) => {
		// 	try {
		// 		const result = await serviceCollection.updateMany(
		// 			{ price: { $type: "string" } }, // filter by type string
		// 			[
		// 				{
		// 					$set: {
		// 						price: { $toDouble: "$price" },
		// 					},
		// 				},
		// 			]
		// 		);
		// 		res.send(result);
		// 	} catch (error) {
		// 		console.error("error: ", error);
		// 		res.status(500).send({ message: "Internal Server Error" });
		// 	}
		// });

		app.get("/services/:id", async (req, res) => {
			try {
				const id = req.params.id;
				const query = { _id: new ObjectId(id) };

				const options = {
					// Include only the `title` and `imdb` fields in the returned document
					projection: { title: 1, price: 1, service_id: 1, img: 1 },
				};

				const result = await serviceCollection.findOne(query, options);
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		// bookings
		app.get("/bookings", logger, verifyToken, async (req, res) => {
			try {
				console.log(req.query.email);
				console.log("token owner info", req.user);
				if (req.user.email !== req.query.email) {
					return res.status(403).send({ message: "forbidden access" });
				}
				let query = {};
				if (req.query?.email) {
					query = { email: req.query.email };
				}
				const result = await bookingCollection.find(query).toArray();
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.post("/bookings", async (req, res) => {
			try {
				const booking = req.body;
				console.log(booking);
				const result = await bookingCollection.insertOne(booking);
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.patch("/bookings/:id", async (req, res) => {
			try {
				const id = req.params.id;
				const filter = { _id: new ObjectId(id) };
				const updatedBooking = req.body;
				console.log(updatedBooking);
				const updateDoc = {
					$set: {
						status: updatedBooking.status,
					},
				};
				const result = await bookingCollection.updateOne(filter, updateDoc);
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		app.delete("/bookings/:id", async (req, res) => {
			try {
				const id = req.params.id;
				const query = { _id: new ObjectId(id) };
				const result = await bookingCollection.deleteOne(query);
				res.send(result);
			} catch (error) {
				console.error("error: ", error);
				res.status(500).send({ message: "Internal Server Error" });
			}
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("doctor is running");
});

app.listen(port, () => {
	console.log(`Car Doctor Server is running on port ${port}`);
});
