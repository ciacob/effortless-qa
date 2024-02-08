import { Sequelize, DataTypes } from "sequelize";
import fs from "fs";
import path from "path";

let sequelize;

/**
 * Uses a model JSON file describing the database tables and their fields in order to create the structure of
 * a real SQLite on-disk database.
 *
 * @param	dbFilePath {String}
 *			The path, on disk to the SQLite database file to write.
 *
 * @param	modelFilePath {String}
 *			The path, on disk to the model JSON file to read database structure from.
 *
 * @param	force {Boolean}
 *			Whether to drop the database if it exists, and to create a new one from scratch.
 *			Normally, if the database file already exist, the function just exits returning `1`.
 *
 * @yields Instantiates module-level variable "sequelize", pointing to a Sequelize instance to reuse in
 *          other functions.
 *
 * @returns	 @returns {Promise<number>} A promise that resolves to a number indicating the result of the
 *          initialization. The number is `0` if database file was not found, and was successfully created;
 *			returns `1` if database file was found, and `force` was false; returns `-1` if database
 *			file was found, but `force` was true, and therefore it was dropped and successfully
 *			recreated; returns `2` or a greater number in any other situation, essentially representing
 *			an error, and the fact that operation failed, and there is likely no database one could use.
 *
 */
export async function initializeDb(dbFilePath, modelFilePath, force) {
  const dbFileFound = fs.existsSync(dbFilePath);
  try {
    // Check if the database file already exists
    if (dbFileFound) {
      if (!force) {
        console.log("Database file already exists. Exiting...");
        return 1;
      } else {
        fs.unlinkSync(dbFilePath);
        console.log("Existing database file dropped.");
      }
    }

    // Create a new Sequelize instance
    sequelize = new Sequelize({
      dialect: "sqlite",
      storage: dbFilePath,
    });

    // Read the model JSON file
    const modelData = JSON.parse(fs.readFileSync(modelFilePath, "utf8"));

    // Define the models
    for (const modelName in modelData) {
      sequelize.define(modelName, modelData[modelName]);
    }

    // Sync the database
    await sequelize.sync({ force: true });
    console.log("Database file created successfully.");
    return force && dbFileFound ? -1 : 0;
  } catch (error) {
    console.error("An error occurred:", error);
    return 2;
  }
}

/**
 * Creates a new project in the database.
 *
 * @param {Object} projectData - The data for the new project.
 * @param	modelFilePath {String}
 *			The path, on disk to the model JSON file to read database structure from.
 * @returns {Promise<Object>} The created project.
 */
export async function createProject(projectData, modelFilePath) {
  try {
    // Read the model JSON file
    const dbSchema = JSON.parse(fs.readFileSync(modelFilePath, "utf8"));

    // Validate the project data
    const validationResult = validateData(dbSchema, "Project", projectData);

    if (validationResult !== 0) {
      console.error("Data integrity validation failed. Project NOT created.");
      return;
    }

    // Get the Project model
    const Project = sequelize.models.Project;

    // Create a new project
    const project = await Project.create(projectData);

    console.log("Project created successfully:", project);
    return project;
  } catch (error) {
    console.error("An error occurred while creating the project:", error);
  }
}

/**
 * Checks if the incoming data type matches the database schema type.
 *
 * @private
 * @param {string} incomingType - The type of the incoming data.
 * @param {string} dbSchemaType - The type in the database schema.
 * @param {*} incomingValue - The actual incoming value.
 * @param {Array} dbEnumValues - The expected values for ENUMs.
 * @returns {boolean} `true` if the types match, `false` otherwise.
 */
function isLegitType(incomingType, dbSchemaType, incomingValue, dbEnumValues) {
  dbSchemaType = dbSchemaType.toLowerCase();

  return (
    // Validate STRINGs, NUMBERs and BOOLEANs
    incomingType === dbSchemaType ||
    // Validate UUIDs
    (incomingType === "string" && dbSchemaType == "uuid") ||
    // Validate ENUMs
    (incomingType === "string" &&
      dbSchemaType === "enum" &&
      incomingValue &&
      dbEnumValues &&
      Array.isArray(dbEnumValues) &&
      dbEnumValues.includes(incomingValue)) ||
    // Validate DATEs
    (incomingType === "object" &&
      dbSchemaType === "date" &&
      incomingValue &&
      Object.prototype.toString.call(incomingValue) === "[object Date]") ||
    // Validate BLOBs (incoming value must be a Uint8Array)
    (incomingType === "object" &&
      dbSchemaType === "blob" &&
      incomingType &&
      incomingType.__proto__.constructor === Uint8Array.prototype.constructor)
  );
}

/**
 * Validates the data against the database schema.
 *
 * @private
 * @param {Object} dbSchema - The database schema.
 * @param {string} tableName - The name of the table.
 * @param {Object} data - The data to validate.
 * @returns {number} `0` if the data is valid, `-1` if there are unknown properties, `1` if there are properties with the wrong data type, `2` if the table is not found in the schema.
 */
function validateData(dbSchema, tableName, data) {
  const tableSchema = dbSchema[tableName];

  if (!tableSchema) {
    console.error(`Table "${tableName}" not found in schema.`);
    return 2;
  }

  for (const key in data) {
    if (!tableSchema[key]) {
      console.error(`Unknown property "${key}" for table "${tableName}".`);
      return -1;
    }

    const dataType = typeof data[key];
    const schemaType = tableSchema[key].type;
    const enumValues = tableSchema[key].values;

    if (!isLegitType(dataType, schemaType, data[key], enumValues)) {
      console.error(
        `Wrong data type for property "${key}". Expected "${schemaType}", got "${dataType}".`
      );
      return 1;
    }
  }

  return 0;
}
