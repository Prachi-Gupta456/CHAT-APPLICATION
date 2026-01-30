import { MongoClient } from "mongodb"
import "dotenv/config"

const url = `${process.env.MONGO_URL}`
const client = new MongoClient(url)

const dbName = "Users"
export const collectionName = "UserList"
let db;

// user schema in mongodb ======================
async function userValidation() {
    try {
        await db.command({
            collMod: collectionName,
            validator: {
                $jsonSchema: {
                    bsonType: "object",
                    required: ["name", "email", "password"],

                    properties: {
                        name: {
                            bsonType: "string",
                            description: "Name must be a string"
                        },
                        email: {
                            bsonType: "string",
                            pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
                            description: "email must be valid"
                        },
                        password: {
                            bsonType: "string",
                            description: "password must be string"
                        }

                    }
                }
            },
            validationLevel: "moderate",
            validationAction: "error"
        })
    }
    catch (error) {
        console.log("Validation Error : ", error.message)
    }
}
// =============================================


export const connection = async () => {
    await client.connect();
    db = client.db(dbName)

    await userValidation();

    await db.collection("chats").createIndex({ users: 1 })
    await db.collection("messages").createIndex({ chatId: 1 })
    await db.collection(collectionName).createIndex({ email: 1 }, { unique: true })

    return db;
}



