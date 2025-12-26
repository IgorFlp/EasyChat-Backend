import jwt from "jsonwebtoken";
import {
  findUserByUsername,
  createUser,
  loginUser,
} from "../services/authService.js";
import { listUserInstances } from "../services/managementService.js";
import { getInstancesByIds } from "../services/evolutionService.js";

const AUTH_SECRET = process.env.AUTH_SECRET;
export function authenticateJWT(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) return res.sendStatus(401);
  jwt.verify(token, AUTH_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
export async function DatabaseAuth(userId, database) {
  let databases = await GetUserDatabase(userId);
  let dbCount = databases.filter((a) => a.database_id == database);
  console.log(JSON.stringify(dbCount));
  if (dbCount.length == 1) {
    return true;
  } else {
    return false;
  }
}
export async function register(req, res) {
  try {
    const { user, password } = req.body;
    //Chamar findUserByUsername
    let find = await findUserByUsername(user);
    if (find.rows.length > 0) {
      res
        .status(409)
        .json({ message: "Nome de usuario existente, favor escolher outro." });
    } else {
      const newUser = {
        id: 0,
        username: user,
        password: password,
      };

      const create = await createUser(newUser);

      if (create.rows[0].id) {
        res.status(200).json({ message: "Usuario criado" });
      } else {
        res.status(401).send("Invalid credentials");
      }
    }
  } catch (e) {
    res.status(404).send("Erro no registro de usuario: " + e.message);
  }
}

export async function login(req, res) {
  try {
    const { user, password } = req.body;
    const login = await loginUser(user, password);
    if (login.rows.length === 0) {
      res.status(404).send("Usuario ou senha incorreto..");
      return;
    }
    let instances = [];
    let instancesIds = [];
    if (login.rows.length > 0) {
      const userId = login.rows[0].id;
      const userName = login.rows[0].username;
      //console.log("UserId: " + userId + " UserName: " + userName);
      // Get user instances
      const insts = await listUserInstances(userId);

      if (insts.length === 0) {
        res.status(404).send("Nenhuma instancia para esse usuario..");
        return;
      } else {
        insts.filter((inst) => {
          instancesIds.push(inst.instance_id);
        });
        //Evolution service get instances
        let instancesNames = await getInstancesByIds(instancesIds);
        if (instancesNames.length === 0) {
          res.status(404).send("Nenhuma instancia para esse usuario..");
          return;
        } else {
          instancesNames.filter((inst) => {
            instances.push(inst.name);
          });
        }
      }
      const token = jwt.sign(
        { userId: userId, userName: userName, instances: instances },
        AUTH_SECRET,
        {
          expiresIn: "2h",
        }
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        maxAge: 2 * 60 * 60 * 1000,
        path: "/",
        ...(process.env.NODE_ENV === "production" && { domain: COOKIE_DOMAIN }),
      });
      res.json({ instances: instances });
    } else {
      res.status(401).send("Invalid credentials");
    }
  } catch (e) {
    res.status(404).send("Erro inexperado no login: " + e.message);
  }
}
export async function logout(req, res) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    ...(isProduction && { domain: COOKIE_DOMAIN }),
  });

  res.status(200).json({ message: "Logout realizado com sucesso" });
}
