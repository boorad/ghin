import { GhinClient } from "../../src";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GHIN_API_ACCESS: string;
      GHIN_API_VERSION: string;
      GHIN_BASE_URL: string;
      GHIN_PASSWORD: string;
      GHIN_USERNAME: string;
    }
  }
}

const fn = async () => {
  const ghinClient = new GhinClient({
    apiAccess: process.env.GHIN_API_ACCESS === "true",
    apiVersion: process.env.GHIN_API_VERSION as "v1",
    baseUrl: process.env.GHIN_BASE_URL,
    password: process.env.GHIN_PASSWORD as string,
    username: process.env.GHIN_USERNAME as string,
  });

  console.log("=".repeat(80));
  console.log("FACILITIES SEARCH - Druid Hills Golf Club, Georgia");
  console.log("=".repeat(80));

  try {
    const druidHillsFacilities = await ghinClient.facilities.search({
      name: "Druid Hills",
      state: "US-GA",
    });

    console.log(
      `\nFound ${druidHillsFacilities.length} facilities matching "Druid Hills" in Georgia:`
    );
    console.dir(druidHillsFacilities, { depth: null });
  } catch (error) {
    console.error("Error searching for Druid Hills facilities:", error);
  }

  console.log("\n" + "=".repeat(80));
  console.log("COURSES SEARCH - Druid Hills Golf Club, Georgia");
  console.log("=".repeat(80));

  try {
    const druidHillsCourses = await ghinClient.courses.search({
      country: "USA",
      name: "Druid Hills",
      state: "US-GA",
    });

    console.log(
      `\nFound ${druidHillsCourses.length} courses matching "Druid Hills" in Georgia:`
    );
    console.dir(druidHillsCourses, { depth: null });
  } catch (error) {
    console.error("Error searching for Druid Hills courses:", error);
  }

  console.log("\n" + "=".repeat(80));
  console.log("FACILITIES SEARCH - Pinehurst, North Carolina");
  console.log("=".repeat(80));

  try {
    const pinehurstFacilities = await ghinClient.facilities.search({
      name: "Pinehurst",
      state: "US-NC",
    });

    console.log(
      `\nFound ${pinehurstFacilities.length} facilities matching "Pinehurst" in North Carolina:`
    );
    console.dir(pinehurstFacilities, { depth: null });
  } catch (error) {
    console.error("Error searching for Pinehurst facilities:", error);
  }

  console.log("\n" + "=".repeat(80));
  console.log("COURSES SEARCH - Pinehurst, North Carolina");
  console.log("=".repeat(80));

  try {
    const pinehurstCourses = await ghinClient.courses.search({
      country: "USA",
      name: "Pinehurst",
      state: "US-NC",
    });

    console.log(
      `\nFound ${pinehurstCourses.length} courses matching "Pinehurst" in North Carolina:`
    );
    console.dir(pinehurstCourses, { depth: null });
  } catch (error) {
    console.error("Error searching for Pinehurst courses:", error);
  }
};

fn();
