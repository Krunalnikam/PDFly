# Assignment Companion

Context: You are a full-stack web development expert building a student assignment assistant tool.

Task: Create a single-page web application where students can:

1. Upload photos of their handwritten/printed assignments

2. Enter student details: Full Name, Roll Number, Subject, and Date

3. Automatically generate a PDF file with the student details on top followed by the uploaded images

4. Download the PDF with filename format: "University_RollNo_Name_Date.pdf"

Guidelines:

- Use React with Tailwind CSS for styling

- Keep the design clean, modern, and mobile-friendly

- Use a card-based layout with clear sections: Upload Area, Student Form, Preview Area

- Show image preview after upload

- Use the jsPDF library for PDF generation

- Show loading state while generating PDF

- Display file size after PDF generation

Constraints:

- No database or authentication needed at this stage

- Use only sample/example data

- Keep all processing client-side (browser only)

- Do not add any payment or API key features

- Focus on simple, working functionality

Acceptance Criteria:

- Upload button accepts JPG, PNG images

- Form fields work and validate (name, roll no, subject required)

- PDF generates and downloads correctly

- Filename matches the specified format

- Works on both desktop and mobile screens

- Shows success message: "Your PDF is ready!"

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://assignment-buddy-17.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/618ecceb-7fb9-42b7-b595-ca42f01e2bf7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
