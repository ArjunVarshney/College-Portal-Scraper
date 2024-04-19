import puppeteer from "puppeteer";
import { config } from "dotenv";
import fs from "fs";
import { bar1 } from "./index.js";
import { percentage } from "./contants.js";
import environment_variables from "./config.js";

config();

let waitForNavigationDone = false;

const sleep = (milliseconds) => {
   return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getSubjectData = async (frame) => {
   await frame.waitForSelector(
      "#STDNT_GRADE_DTL\\$scrolli\\$0 > tbody > tr > td > table"
   );
   await sleep(500);

   // all the rows in the subject table
   const rows = await frame.$$(
      "#STDNT_GRADE_DTL\\$scrolli\\$0 > tbody > tr > td > table > tbody tr"
   );

   const allData = {};

   for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const data = await frame.evaluate((e) => {
         const cells = e.querySelectorAll("td");
         const assignment = cells[2].querySelector("div > span > a").innerText;
         const grade =
            cells[4].querySelector("div > span")?.innerText?.split(".")[0] || 0;
         const maxMarks = cells[5].querySelector("div > span").innerText;
         const marksString = grade + "/" + maxMarks;
         return {
            assignment,
            marks: marksString,
         };
      }, row);

      allData[data.assignment] = data.marks;
   }

   return allData;
};

const getDatewiseAttendance = async (frame) => {
   await frame.waitForSelector("#CLASS_ATTENDNCE\\$scroll\\$0");
   await sleep(500);
   const rows = await frame.$$("#CLASS_ATTENDNCE\\$scroll\\$0 > tbody tr");

   const allData = {};
   const component = await frame.evaluate(() => {
      return document.querySelector("#PSXLATITEM_XLATSHORTNAME")?.innerText;
   });

   for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const data = await frame.evaluate((e) => {
         const cells = e.querySelectorAll("td");
         const date = cells[0]?.querySelector("div > span")?.innerText;
         const type = cells[1]?.querySelector("div > span")?.innerText;
         const present = cells[3]?.querySelector("div > input")?.checked;
         return { date, type, present };
      }, row);
      if (!allData[data.date]) allData[data.date] = [];
      allData[data.date].push({ type: data.type, present: data.present });
   }

   return [allData, component];
};

const login = async (page) => {
   // type in the password and username
   await page.evaluate(() => {
      if (document.querySelector("a").innerText.includes("Sign in")) {
         document.querySelector("a").click();
      }
   });
   await page.waitForSelector("#userid");
   await sleep(500);
   await page.type(
      "#userid",
      process.env.COLLEGE_USER_ID || environment_variables.COLLEGE_USER_ID
   );
   await page.type(
      "#pwd",
      process.env.COLLEGE_PASSWORD || environment_variables.COLLEGE_PASSWORD
   );
   await page.keyboard.press("Enter");
};

const getSubjectInformation = async (page) => {
   await page.waitForSelector("#ptnav2pglt");
   await sleep(2000);

   page.goto(
      "https://campus.srmcem.ac.in/psp/ps/EMPLOYEE/HRMS/c/SA_LEARNER_SERVICES.SS_LAM_STD_GR_LST.GBL?PORTALPARAM_PTCNAV=HC_SS_LAM_STD_GR_LST_GBL1&amp;EOPP.SCNode=HRMS&amp;EOPP.SCPortal=EMPLOYEE&amp;EOPP.SCName=CO_EMPLOYEE_SELF_SERVICE&amp;EOPP.SCLabel=Self%20Service&amp;EOPP.SCPTfname=CO_EMPLOYEE_SELF_SERVICE&amp;FolderPath=PORTAL_ROOT_OBJECT.CO_EMPLOYEE_SELF_SERVICE.HCCC_ENROLLMENT.HC_SS_LAM_STD_GR_LST_GBL1&amp;IsFolder=false"
   );
   await sleep(500);

   page.waitForSelector("#ptifrmtgtframe");
   await sleep(2000);

   const frame = await page
      .frames()
      .find((frame) => frame.name() === "TargetContent");

   await frame.waitForSelector("body");
   await frame.waitForSelector("body > form");
   await frame.waitForSelector("#win0divPAGECONTAINER > table");
   await frame.waitForSelector("#DERIVED_SSS_SCT_SSR_PB_GO");
   await sleep(2000);

   await frame.evaluate(() => {
      document
         .querySelector("tbody > tr:last-child > td > div > input")
         .click();
      // click on continue
      document.querySelector("#DERIVED_SSS_SCT_SSR_PB_GO").click();
   });

   //  go to Every link inside the table and extract the data
   await frame.waitForSelector("#win0divCLASS_TBL\\$0 table tbody");
   await sleep(500);

   //  rows contain all the rows of the table
   const rows = await frame.$$("#win0divCLASS_TBL\\$0 table tbody tr");

   //  this contains the final data of all the subjects
   const finalData = {};

   for (let i = 1; i < rows.length; i++) {
      await frame.waitForSelector("#win0divCLASS_TBL\\$0 table tbody");
      await sleep(500);

      const rows = await frame.$$("#win0divCLASS_TBL\\$0 table tbody tr");

      const row = rows[i];

      // all the columns of the row are in cells
      const cells = await row.$$("td");

      const subjectName = await frame.evaluate((e) => {
         return e.querySelector("div > span > a").innerText;
      }, cells[0]);

      // only click on the first cell to go to the details of the actual subject
      await frame.evaluate((e) => {
         e.querySelector("div > span > a").click();
      }, cells[0]);

      await frame.waitForSelector("#STDNT_GRADE_DTL\\$scrolli\\$0");
      await sleep(500);

      // get data of the subject at ith position
      let data = await getSubjectData(frame);

      // populate the final data object with the data extracted
      finalData[subjectName] = data;

      // Go back to the all subjects page
      await frame.evaluate(() => {
         document.querySelector("#DERIVED_SSR_FC_SSS_CHG_CLS_LINK").click();
      });
      bar1.increment(percentage.assignmentFetch / rows.length);
      await sleep(2000);
   }

   return finalData;
};

const getAttendanceInformation = async (page) => {
   await page.goto(
      "https://campus.srmcem.ac.in/psp/ps/EMPLOYEE/HRMS/c/MANAGE_ACADEMIC_RECORDS.STDNT_ATTEND_TERM.GBL?FolderPath=PORTAL_ROOT_OBJECT.HCSR_CURRICULUM_MANAGEMENT.HCSR_ATTENDANCE_ROSTER.HC_STDNT_ATTENDANCE_GBL&IsFolder=false&IgnoreParamTempl=FolderPath%2cIsFolder"
   );

   await page.waitForSelector("#ptifrmtgtframe");
   await sleep(2000);

   const frame = await page
      .frames()
      .find((frame) => frame.name() === "TargetContent");

   await frame.waitForSelector("body");
   await frame.waitForSelector("#win0divSEARCHRESULT");
   await frame.waitForSelector("#win0divSEARCHRESULT > table > tbody");
   await frame.waitForSelector("#win0divSEARCHRESULT > table > tbody");
   await sleep(2000);

   await frame.evaluate(() => {
      document
         .querySelector(
            "#PTSRCHRESULTS > tbody > tr:nth-child(2) > td:first-child > a"
         )
         .click();
   });
   const finalData = {};

   await frame.waitForSelector("body > form");
   await frame.waitForSelector("#SRM_CLAS_PER_DR_TOTAL_PERCENT");
   await sleep(500);

   // get the total attendance
   const totalAtt = await frame.evaluate(() => {
      return (
         document.querySelector("#SRM_CLAS_PER_DR_TOTAL_PERCENT").innerText +
         "%"
      );
   });

   // populate in the finalData
   finalData["total"] = totalAtt;

   // scrape the data from the attendance table
   await frame.waitForSelector("#STDNT_ENRL\\$scroll\\$0 tbody");
   await sleep(2000);

   const rows = await frame.$$("#STDNT_ENRL\\$scroll\\$0 tbody tr");

   for (let i = 3; i < rows.length; i++) {
      await frame.waitForSelector("#STDNT_ENRL\\$scroll\\$0 tbody");
      await sleep(500);

      const rows = await frame.$$("#STDNT_ENRL\\$scroll\\$0 tbody tr");

      const row = rows[i];

      const data = await frame.evaluate((e) => {
         const cells = e.querySelectorAll("td");
         const subject = cells[1].querySelector("div > span").innerText;
         const percentage = cells[5].querySelector("div > span").innerText;
         return { subject, percentage };
      }, row);

      await frame.evaluate((e) => {
         e.querySelector("td:first-child > div > span > a").click();
      }, row);

      const [att_sub_data, component] = await getDatewiseAttendance(frame);
      // click on Attendance Roster by student button
      await page.evaluate(() => {
         document
            .querySelector("#pthnavbccrefanc_HC_STDNT_ATTENDANCE_GBL")
            .click();
      });

      //  storing in finalData according to the names
      if (data.subject.includes("Lab") || data.subject.includes("LAB")) {
         finalData[data.subject] = {
            percentage: data.percentage,
            datewise: att_sub_data,
         };
      } else {
         finalData[data.subject + " " + `(${component})`] = {
            percentage: data.percentage,
            datewise: att_sub_data,
         };
      }
      bar1.increment(percentage.attendanceFetch / rows.length);
      await sleep(2000);
   }

   return finalData;
};

const getCollegeData = async () => {
   try {
      const browser = await puppeteer.launch({ headless: "new" });

      // do everything in a incognito tab
      const context = await browser.createIncognitoBrowserContext();
      const page = await context.newPage();
      // goto college web portal
      await page.goto(
         "https://campus.srmcem.ac.in/psp/ps/?cmd=login&languageCd=ENG&"
      );

      page.setDefaultTimeout(60 * 1000);
      page.setDefaultNavigationTimeout(60 * 1000);

      await sleep(500);

      //  login to the website before getting the data
      await login(page);
      bar1.increment(percentage.login);

      const subjectData = await getSubjectInformation(page);
      await sleep(2000);
      const attendanceData = await getAttendanceInformation(page);

      await browser.close();

      fs.writeFile(
         "data.json",
         JSON.stringify({
            academics: subjectData,
            attendance: attendanceData,
         }),
         function (err) {
            if (err) throw err;
         }
      );

      return {
         academics: subjectData,
         attendance: attendanceData,
      };
   } catch (err) {
      console.log("\n\n" + err);
   }
};

export { getCollegeData, sleep };
