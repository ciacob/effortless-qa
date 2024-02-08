/**
 * “EffortlessQA: Streamlining Your Testing Process with Simplicity”
 */
const appName = "EffortlessQA";

const dbPath = "./app/db/storage.sqlite";
const dbSchemaPath = "./app/model/db-schema.json";

// [TESTS]
const force = true; // or false, depending on your needs
const projectData = {
    name: 'ACME',
    tagline: 'Things That Work, In Theory.',
    description: 'ACME is the omnipresent corporation building things that break, in all the early cartoons of the 20th century.'
};
// [/TESTS]

import { initializeDb, createProject } from "./app/modules/db-handler.js";

// MAIN
(async function main() {
    try {
      const result = await initializeDb(dbPath, dbSchemaPath, force);
      console.log("Database initialization result:", result);
  
      // If we have a database we can use
      if (result < 2) {
        const project = await createProject(projectData, dbSchemaPath);
        console.log("Project creation result:", project);
      }
    } catch (error) {
      console.error("An error occurred:", error);
    }
  })();
