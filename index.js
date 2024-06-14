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
    origin: [
      "http://localhost:5173",
      "https://survey-quest-ae959.web.app",
      "https://survey-quest-ae959.firebaseapp.com",
    ],
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
let commentCollection;
let reportCollection;
let paymentCollection;
let participateCollection;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    userCollection = client.db("surveyDb").collection("users");
    surveyCollection = client.db("surveyDb").collection("surveys");
    commentCollection = client.db("surveyDb").collection("comments");
    reportCollection = client.db("surveyDb").collection("reports");
    paymentCollection = client.db("surveyDb").collection("payments");
    participateCollection = client.db("surveyDb").collection("participates");

    //Make user to pro user
    app.patch("/users/:id/make-pro-user", async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "pro-user" } }
      );
      res.send(result);
    });

    //Make pro user to user
    app.patch("/users/:id/make-user", async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "user" } }
      );
      res.send(result);
    });

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

    // Auth related API
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

    // If invallid token then clear jwt
    app.post("/clear-jwt", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Check if user is a admin
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

    // Check if user is a pro user
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

    // Check if user is a surveyor
    app.get("/users/surveyor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let surveyor = false;
      if (user) {
        surveyor = user?.role === "surveyor";
      }
      res.send({ surveyor });
    });

    // Check if user is a user
    app.get("/users/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const queryUser = await userCollection.findOne(query);
      let user = false;
      if (queryUser) {
        user = queryUser?.role === "user";
      }
      res.send({ user });
    });

    //Update survey by id
    app.patch("/surveys/:id", async (req, res) => {
      const updatedSurvey = req.body;
      const id = req.params.id;
      const result = await surveyCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            image: updatedSurvey.image,
            title: updatedSurvey.title,
            description: updatedSurvey.description,
            category: updatedSurvey.category,
            deadline: updatedSurvey.deadline,
          },
        }
      );
      res.send(result);
    });

    // Surveys related API
    app.get("/surveys", async (req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    });

    // Post survey
    app.post("/surveys", async (req, res) => {
      const survey = req.body;
      const result = await surveyCollection.insertOne(survey);
      const email = { email: survey.surverior };
      const admin = await userCollection.findOne(email);

      // Update user role to 'surveyor'
      let updateUserRole;
      if (admin && admin.role !== "admin") {
        updateUserRole = await userCollection.updateOne(email, {
          $set: { role: "surveyor" },
        });
      }

      res.send({ result, updateUserRole });
    });

    // Vote to survey
    app.put("/surveys/:id/vote", async (req, res) => {
      const newVote = req.body;
      const id = req.params.id;
      const result1 = await surveyCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { voteCount: newVote.voteCount } }
      );
      const participateData = {
        votedUserName:newVote.votedUserName,
        votedUserEmail:newVote.votedUserEmail,
        surveyId:newVote.surveyId,
        usersVote:newVote.usersVote,
      };
      const result2 = await participateCollection.insertOne(participateData);
      res.send({result1, result2});
    });
    // get participates
    app.get("/participates", async (req, res) => {
      res.send(await participateCollection.find().toArray());
    });

    // Post payments
    app.post("/payments", async (req, res) => {
      const paymentData = req.body;
      const email = { email: paymentData.email };
      const result = await paymentCollection.insertOne(paymentData);
      const admin = await userCollection.findOne(email);

      // Update user role to 'surveyor'
      let updateUserRole;
      if (admin && admin.role !== "admin") {
        updateUserRole = await userCollection.updateOne(email, {
          $set: { role: "pro-user" },
        });
      }

      res.send({ result, updateUserRole });
    });
    // Get payments
    app.get("/payments", async (req, res) => {
      res.send(await paymentCollection.find().toArray());
    });

    // Post Survey Comment
    app.post("/comments", async (req, res) => {
      const newComment = req.body;
      res.send(await commentCollection.insertOne(newComment));
    });

    // Get Survey Comments
    app.get("/comments", async (req, res) => {
      res.send(await commentCollection.find().toArray());
    });

    // Post survey report
    app.post("/reports", async (req, res) => {
      const newReport = req.body;
      res.send(await reportCollection.insertOne(newReport));
    });

    // Get Survey reports
    app.get("/reports", async (req, res) => {
      res.send(await reportCollection.find().toArray());
    });

    // Toggle Status Change
    app.patch("/surveys/:id/publish", async (req, res) => {
      const id = req.params.id;
      const result = await surveyCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "publish" } }
      );
      res.send(result);
    });

    app.patch("/surveys/:id/unpublish", async (req, res) => {
      const id = req.params.id;
      const result = await surveyCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "unpublish" } }
      );
      res.send(result);
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
