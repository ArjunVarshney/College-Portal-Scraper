import { Client } from "@notionhq/client";
import { config } from "dotenv";
import cliProgress from "cli-progress";
import { getCollegeData, sleep } from "./scraper.js";
import ansiColors from "ansi-colors";
import { percentage, day, month } from "./contants.js";
import environment_variables from "./config.js";
config();

const bar1 = new cliProgress.SingleBar(
  {
    format: "Progress: |" + ansiColors.cyan("{bar}") + "| {percentage}% ",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  },
  cliProgress.Presets.rect
);

const nthNumber = (number) => {
  if (number > 3 && number < 21) return "th";
  switch (number % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

const notion = new Client({
  auth:
    process.env.NOTION_TOKEN ||
    environment_variables.NOTION_TOKEN,
});

const database_id = process.env.DATABASE_ID || environment_variables.DATABASE_ID;

// function to delete all pages in the database in notion
const deleteAllPages = async () => {
  try {
    const listResponse = await notion.databases.query({
      database_id,
    });

    for (const page of listResponse.results) {
      await notion.pages.update({
        page_id: page.id,
        archived: true,
      });
      bar1.increment(percentage.deleteAllPage / listResponse.results.length);
    }
  } catch (err) {
    console.log(err);
  }
};

// function to create pages in notion with the updated information
const createPage = async (properties, children) => {
  await notion.pages.create({
    icon: {
      type: "external",
      external: {
        url: "https://cdn-icons-png.flaticon.com/512/1903/1903172.png",
      },
    },
    parent: {
      type: "database_id",
      database_id,
    },
    properties,
    children,
  });
};

// function to process attendance data and make it usable
const mergeAttendance = (att1, att2) => {
  // put Lecture instaed of MTG in the type of att1
  Object.keys(att1).forEach((date) => {
    att1[date].forEach((element) => {
      if (element.type == "MTG") {
        element.type = "Lecture";
      }
    });
  });
  // put Tutorial instaed of MTG in the type of att2
  Object.keys(att2).forEach((date) => {
    att2[date].forEach((element) => {
      if (element.type == "MTG") {
        element.type = "Tutorial";
      }
    });
  });

  // merge the dates which are same in tutorial and lecture
  for (const [date, data] of Object.entries(att2)) {
    if (att1[date] != undefined) {
      att1[date] = [...att1[date], ...data];
      delete att2[date];
    }
  }

  // Sort the object according to the date
  const merged = { ...att1, ...att2 };

  const sortedKeys = Object.keys(merged).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });

  const finalObject = {};
  sortedKeys.forEach((key) => {
    finalObject[key] = merged[key];
  });

  return finalObject;
};

const getAllAttendanceData = (att_data) => {
  const merged = {};
  delete att_data["total"];
  for (const [subject, att] of Object.entries(att_data)) {
    const data = att.datewise;
    for (const [date, days] of Object.entries(data)) {
      if (!merged[date]) merged[date] = [];
      days.forEach((lec) => {
        merged[date].push({
          type: subject,
          present: lec.present,
        });
      });
    }
  }
  const sortedKeys = Object.keys(merged).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });

  const finalObject = {};
  sortedKeys.forEach((key) => {
    finalObject[key] = merged[key];
  });

  while (Object.keys(finalObject).length > 95) {
    const oldest_date = Object.keys(finalObject)[0];
    delete finalObject[oldest_date];
  }

  return finalObject;
};

const createBlocks = (att) => {
  const blocks = [];

  if (!att) {
    blocks.push({
      object: "block",
      callout: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Attendance not found !",
            },
            annotations: {
              bold: true,
            },
          },
        ],
      },
    });
    return blocks;
  }

  for (const [date, data] of Object.entries(att)) {
    const child_blocks = [];

    data.forEach((lec) => {
      child_blocks.push({
        type: "to_do",
        to_do: {
          rich_text: [
            {
              type: "text",
              text: {
                content: lec.type || "None",
              },
            },
          ],
          checked: lec.present,
        },
      });
    });

    const att_date = new Date(date);

    blocks.push({
      object: "block",
      callout: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `${month[att_date.getMonth() || 0]} ${
                att_date.getDate() || 1
              }${nthNumber(att_date.getDate() || 1)}, ${
                att_date.getFullYear() || 2100
              } (${day[(att_date.getDay() || 5) - 1]})`,
            },
            annotations: {
              bold: true,
            },
          },
        ],
        icon: {
          emoji: "📅",
        },
        children: child_blocks,
      },
    });
  }

  return blocks.reverse();
};

const main = async () => {
  try {
    bar1.start(100, 0);
    const collegeData = await getCollegeData();
    // const collegeData = JSON.parse(fs.readFileSync("./data.json"));

    const academicData = collegeData?.academics;
    const attendanceData = collegeData?.attendance;

    await deleteAllPages();

    // add the total attendance as the first page
    let total_att_layout = {
      Subject: {
        title: [
          {
            text: {
              content: "Total Attendance",
            },
          },
        ],
      },
      Attendance: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: attendanceData["total"],
            },
          },
        ],
      },
    };

    // to get the attendance data
    const total_att_data = getAllAttendanceData({ ...attendanceData });

    // contains all the blocks for notion
    const total_att_blocks = createBlocks(total_att_data);

    // final block structure to be appended in notion
    let total_att_page_content = [
      {
        object: "block",
        heading_2: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Total Attendance",
              },
            },
          ],
        },
      },
      ...total_att_blocks,
    ];

    // create pages in notion page
    await createPage(total_att_layout, total_att_page_content);

    for (const [subjectName, sub_Details] of Object.entries(academicData)) {
      let sub_Attendance =
        attendanceData[subjectName + " (Lecture)"]?.percentage + "%";

      let sub_datewise_att =
        attendanceData[subjectName + " (Lecture)"]?.datewise;

      if (attendanceData[subjectName + " (Tutorial)"]) {
        const sub_tut_Attendance =
          attendanceData[subjectName + " (Tutorial)"].percentage;
        sub_Attendance += " | " + sub_tut_Attendance + "%";
        sub_datewise_att = mergeAttendance(
          sub_datewise_att,
          attendanceData[subjectName + " (Tutorial)"].datewise
        );
      }
      if (subjectName.includes("Lab")) {
        sub_Attendance = attendanceData[subjectName].percentage + "%";
        sub_datewise_att = attendanceData[subjectName].datewise;
      }

      // database fields data
      let layout = {
        Subject: {
          title: [
            {
              text: {
                content:
                  subjectName.charAt(0).toUpperCase() + subjectName.slice(1),
              },
            },
          ],
        },
        Attendance: {
          type: "rich_text",
          rich_text: [
            {
              text: {
                content: sub_Attendance,
              },
            },
          ],
        },
      };

      // finding max length of assignment for better formatting
      let max = 0;
      for (const [assignment, marks] of Object.entries(sub_Details)) {
        if (assignment.length > max) {
          max = assignment.length;
        }
      }
      // for formating the data
      const spaceString = "          ";

      // test details
      const testDetails = [];
      for (const [assignment, marks] of Object.entries(sub_Details)) {
        let type =
          assignment + spaceString.substring(0, max - assignment.length);
        testDetails.push({
          type: "text",
          text: {
            content: `${type}  : ${marks}${assignment == "GRACE" ? "" : "\n"}`,
          },
        });
      }

      // create blocks for the attendance
      const att_blocks = createBlocks(sub_datewise_att);

      // content of the page to be appended inside the page of the  respective subject
      let pageContent = [
        {
          object: "block",
          code: {
            rich_text: [...testDetails],
            language: "json",
          },
        },
        {
          object: "block",
          heading_2: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "Attendance",
                },
              },
            ],
          },
        },
        ...att_blocks,
      ];

      await createPage(layout, pageContent);
      bar1.increment(
        percentage.updatePages / Object.entries(academicData).length
      );
    }
  } catch (error) {
    console.log(
      "May be something is wrong with the portal ! The code works fine...."
    );
    console.log(error);
    await sleep(1000 * 60 * 5);
    main();
  }
};

(async () => {
  console.log(new Date(), "\nRefreshing....");
  await main();
  bar1.update(100);
  await sleep(300);
  console.log("\nDone !");
  throw new Error(
    "This is Just to stop the endlessly running program! Thanks for using! bye...bye...!"
  );
})();

export { bar1 };
