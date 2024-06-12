const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middlewares
const logger = async (req, res, next) => {
  console.log("Called", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

// verify admin after verify token
const verifyAdmin = async (req, res, next) => {
  const email = req.user.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  let isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nrlryfn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let userCollection;
let surveyCollection;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    userCollection = client.db("surveyDb").collection("users");
    surveyCollection = client.db("surveyDb").collection("surveys");

    // Users related API
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "User already exist",
        });
      }
      if (!existingUser) {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    });

    // AUTH related API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // if invallid token then clear jwt
    app.post("/clear-jwt", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // check if user is a admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log("Request Email:", email);
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      console.log("User Role:", user?.role);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // check if user is a pro user
    app.get("/users/proUser/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let proUser = false;
      if (user) {
        proUser = user?.role === "pro-user";
      }
      res.send({ proUser });
    });

    // Surveys related API
    app.get("/surveys", async (req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    });

    app.post("/surveys", async (req, res) => {
      const survey = req.body;
      const result = await surveyCollection.insertOne(survey);
      res.send(result);
    });

    // update survey
    app.put("/surveys", async (req, res) => {
      try {
        const newInfo = req.body;
        const updateDoc = {
          $set: {
            vote: {
              voteCount: newInfo.voteCount,
              votedUser: newInfo.votedUser,
            },
          },
        };

        const result = await surveyCollection.updateOne(
          { _id: newInfo.id },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Survey not found" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "An error occurred while updating the survey" });
      }
    });

    // Update Survey Comment
    app.put("/surveys/comment", async (req, res) => {
      try {
        const newData = req.body;
        const updateDoc = {
          $set: {
            comments: {
              comment: newData.comment,
              commentedUser: newData.commentedUser,
            },
          },
        };

        const result = await surveyCollection.updateOne(
          { _id: newData.id },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Survey not found" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "An error occurred while updating the survey" });
      }
    });

    // update survey report
    app.put("/surveys/report", async (req, res) => {
      try {
        const newReport = req.body;
        const updateDoc = {
          $set: {
            reports: {
              reportedUser: newReport.reportedUser,
            },
          },
        };

        const result = await surveyCollection.updateOne(
          { _id: newReport.id },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Survey not found" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "An error occurred while updating the survey" });
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
  res.send("survey is running");
});

app.listen(port, () => {
  console.log(`Survey Quest is running on port: ${port}`);
});
