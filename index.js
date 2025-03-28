import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2"
import session from "express-session";
import dotenv from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
dotenv.config();

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize ());
app.use(passport.session());

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
db.connect();

// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("home.ejs");
});
app.get("/login", (req, res) => {
    res.render("login.ejs");
});
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.get("/logout", (req, res) => {
    req.logout(function (err) {
        if(err){
            return next(err);
        }
        res.redirect("/");
    });
});

app.get("/secrets", (req, res)=>{
    if(req.isAuthenticated()){
        res.render("secrets.ejs");
    } else {
        res.redirect("/login");
    }
});
app.get(
    "/auth/google",
    passport.authenticate("google", {scope: ["profile", "email"],
    })
);
app.get(
    "/auth/google/secrets",
    passport.authenticate("google", {
        successRedirect: "/secrets",
        failureRedirect: "/login",
    })
);
app.post(
    "/login",
    passport.authenticate("local", {
        successRedirect: "/secrets",
        failureRedirect: "/login",
    })
);

app.post("/register", async (req, res)=>{
    const email = req.body.username;
    const password = req.body.password;

    try{
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1",[
            email,
        ]);
//         if(checkResult.rows.length > 0){
//             res.send("Email already exists.Try logging in.");
//         } else {
//             const result = await db.query(
//                 "INSERT INTO users (email, password) VALUES ($1, $2)", [email, password] 
//             );
//             console.log(result);
//             res.render("secrets.ejs");
//         }
//     } catch (err) {
//         console.log(err);
//     }
// });
        if (checkResult.rows.length > 0){
            res.redirect("/login");
        } else {
            
        // }
        // if(checkResult.rows.length > 0) {
        //     res.send("Email already exists. Try loggin in.");
        // } else {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if(err){
                    console.error("Error hashing password:", err);
                } else {
                    // console.log("Hashed Password:", hash);
                    const result = await db.query(
                        "INSERT INTO users (email, password) VALUES ($1 , $2) RETURNING *",
                        [email, hash]
                    );
                    const user = result.rows[0];
                    req.login(user, (err) => {
                        console.log("success");
                        res.redirect("/secrets");
                    });
                    // res.render("secrets.ejs")
                }
            });
        }
    } catch (err) {
    console.log(err);
    }
});
passport.use(
    "local",
    new Strategy(async function verify(username, password, cb) {
    try{
       const result = await db.query("SELECT * FROM users WHERE email = $1 ", [ 
        username,
       ]);
       if(result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            if(err){
                console.error("Error comparing passwords:", err); 
                return cb(err);
            } else {
                if (valid) {
                    return cb(null, user);
                } else {
                    return cb(null, false);
                }
            }
        });
       } else {
        return cb ("User not found");
       }
    } catch (err) {
        console.log(err);
    }
    })
);

passport.use(
    "google",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/secrets",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        async(accessToken, refreshToken, profile,cb)=> {
            try{
                console.log(profile);
                const result = await db.query("SELECT * FROM users WHERE email = $1", [
                    profile.email,
                ]);
                if (result.rows.length === 0) {
                    const newUser = await db.query(
                        "INSERT INTO users (email, password) VALUES ($1, $2)",
                        [profile.email, "google"]
                    );
                    return cb(null, newUser.rows[0]);
                } else{
                    return cb(null, result.rows[0]);
                }
            }catch (err) {
                return cb(err);
            }
        }
    )
);
passport.serializeUser((user, cb) =>{
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    cb(null, user);
});

        // app.post("/login", async (req, res) => {
        //     const email = req.body.username;
        //     const loginPassword = req.body.password;
        
        // try{
        //     const result = await db.query("SELECT * FROM users WHERE email = $1",[
        //     email,
        // ]);

        // if(result.rows.length > 0){
        //     const user = result.rows[0];
        //     const storedHashedPassword = user.password;

        // bcrypt.compare(loginPassword, storedHashedPassword, (err, result)=> {
        //     if (err){
        //         console.error("Error comparing passwords:", err);        
        //     } else {
        //         if(result){
        //             res.render("secrets.ejs"); 
        //         } else { 
        //             res.send("Incorrect Password");
        //             }
        //         }
        //         });
        //     } else { 
        //         res.send("User not found");
        //         }
        //         } catch (err) {
        //             console.log(err);
        //         }
        // });

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});