# College Portal Scraper

We all are familiar with the user friendliness that our college portal provides us (it sucks)😐.
Therefore, I made a program to scrape the portal and display it onto a notion page that solves the problem of clicking an endless stream of pointless buttons and navigating our way through the menus to see our attendance and view our marks.

To set up the program to run it locally on you computer follow the steps below:-

**Step 1:** Clone this repository -

`git clone https://github.com/ArjunVarshney/College-Portal-Scraper.git`

**Step 2:** Install the necessary npm modules -

`npm install`

**Step 3:** Setup notion Integration -

- Install notion if you haven't and create or login to your account
- Go to `https://www.notion.so/my-integrations` and create a "New Integration"
- Fill all the necessary details
- Save the secret token that appears at the end

**Step 4:** Setup notion page -

- Create a new notion page by clicking on "Add a page" button
- Give a title to your page
  ![notion title sample](/sample/notion_empty_sample.png)
- Create a new database by typing "/database" and click "Enter"
  ![notion database sample](/sample/notion_database_sample.png)
- Delete "tags" field from the database and Rename "Name" field to "Subject"
  ![delete tags](/sample/delete_Tags_sample.png)
  ![rename name](/sample/rename_name_sample.png)
- Create a field named "Last Updated" of type "Created time".
- Create another field named "Attendance" of type "Text".
- At the end of all this your database should look like this
  ![complete database sample](/sample/complete_database_sample.png)
- Save the id of this database -
  - To get the id, Copy the database link (click on "Copy link to view") and extract the id
    eg - if the link is - "https://www.notion.so/arjunvarshney/**1e91e0f8b2ed435480e180xxxxxxxxxx**?v=58f03c0390104bc4816cacec6be89d7d"
    then "1e91e0f8b2ed435480e180xxxxxxxxxx" is the database id.

**Step 5:** Change necessary files -

- Rename "sample.env" to ".env"

  - Fill your data inside
    ![sample env](/sample/env_sample.png)
  - Save the file

- Rename "sample_config.js" to "config.js"

  - Fill your data inside
    ![sample config](/sample/config_sample.png)
  - Save the file

  > **Note:** I had to do this because windows task scheduler does not recognize .env file

- Change file path in "CollegeUpdate.bat" file
  ![sample batch file](/sample/update_batch_sample.png)
  - Save the file

Now you are good to go, You can run the index file as is or further automate using windows task scheduler.

How to automate run batch files using task scheduler - https://youtu.be/lzy8KNnqV0I
(You can use the "CollegeUpdate.bat" file for this purpose)
