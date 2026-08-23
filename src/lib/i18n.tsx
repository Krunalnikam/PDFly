import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "hi" | "gu";

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    label: "English (United States)",
    nativeLabel: "English (US)",
    flag: "🇺🇸",
  },
  {
    code: "hi",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    flag: "🇮🇳",
  },
  {
    code: "gu",
    label: "Gujarati",
    nativeLabel: "ગુજરાતી",
    flag: "🇮🇳",
  },
];

const LANGUAGE_STORAGE_KEY = "assignment_pdf_language";

export const translations = {
  en: {
    // Header & App Identity
    appTitle: "Assignment PDF Maker",
    appTagline: "Student toolkit",
    appDescription:
      "Upload assignment photos, auto-detect document borders, perspective crop, and download a submission-ready PDF.",
    settings: "Settings",
    theme: "Theme",
    lightMode: "Light",
    darkMode: "Dark",
    language: "Language",
    englishUs: "English (US)",
    hindi: "हिन्दी (Hindi)",
    gujarati: "ગુજરાતી (Gujarati)",
    savedProfile: "Saved Profile",
    saveStudentProfile: "Save Student Profile",
    editProfile: "Edit",
    editProfileTitle: "Edit Branch & Enrollment Number",
    profileActive: "Profile Active",

    // Step 1: Upload Photos
    step1Title: "1. Upload assignment photos",
    smartFilter: "Smart Filter",
    smartFilterTooltip: "Automatically enhances text contrast, exposure, and clarity",
    on: "ON",
    off: "OFF",
    autoCropAll: "Auto-Crop All",
    scanningPages: "Scanning...",
    uploadPrompt: "Tap to add JPG or PNG photos",
    uploadSubtext: "You can select multiple pages at once",
    uploadedPagesHeader: "Uploaded Pages ({count}) — Ordered 1 to {count}",
    reverseOrder: "Reverse Order",
    reverseOrderTooltip: "Reverse the current page order (Page 1 ↔ Page N)",
    orderReversedNotify: "Page order reversed (1 to {count})",
    pageInPdf: "Page {num} in PDF",
    scannedAndCropped: "Scanned & Cropped",
    originalPhoto: "Original Photo",
    scanCropBtn: "Scan / Crop",
    rotateLeftTitle: "Rotate Left 90° (Counter-Clockwise)",
    rotateRightTitle: "Rotate Right 90° (Clockwise)",
    revertToOriginalTitle: "Revert to Original",
    moveUpTitle: "Move Up",
    moveDownTitle: "Move Down",
    deletePhotoTitle: "Delete photo",

    // Step 2: Submission Details
    step2Title: "2. Submission details",
    step2DescSaved:
      "Your Branch and Enrollment Number are saved on this browser. Just enter the Subject and Exam Phase.",
    step2DescNew:
      "Enter your Branch and Enrollment Number once. They will be saved on this browser for future assignments.",
    savedStudentProfile: "Saved Student Profile",
    savedInBrowser: "(Saved in browser)",
    branchLabel: "Branch:",
    enrollNoLabel: "Enroll No:",
    editDetailsBtn: "Edit Details",
    oneTimeSetup: "1-Time Student Profile Setup",
    savesInBrowser: "Saves in your browser",
    branchRequired: "Branch *",
    branchPlaceholder: "e.g. CE, IT, ME",
    enrollmentRequired: "Enrollment Number *",
    enrollmentPlaceholder: "e.g. 25002170110091",
    saveDetailsFuture: "Save Details for Future",
    subjectRequired: "Subject *",
    subjectPlaceholder: "e.g. DS",
    subjectExample: "Example: DS, Java-2, TOC, DCN",
    examPhaseRequired: "Exam Phase *",
    examPhasePlaceholder: "e.g. T1",
    examPhaseExample: "Example: T1, T2, T3, Assignment-1",

    // Step 3: Preview & Download
    step3Title: "3. Preview & download",
    pagesInFinalPdf: "{count} {pageWord} will be in the final PDF",
    pageSingle: "page",
    pagePlural: "pages",
    targetFilename: "Target Filename:",
    emptyPreviewPlaceholder: "Your uploaded pages will appear here.",
    compressionAndQuality: "Compression & Quality",
    standardPreset: "Standard",
    highPreset: "High",
    compactPreset: "Compact",
    standardQualityBadge: "Balanced",
    highQualityBadge: "Crispest",
    compactQualityBadge: "Smallest",
    standardQualityDesc: "Normal compression, balanced for general submissions.",
    highQualityDesc: "Minimal compression, highest visual clarity for detailed diagrams.",
    compactQualityDesc: "Maximum compression, tiny file size under submission portal limits.",
    generateDownloadPdf: "Generate & download PDF",
    generatingPdf: "Generating PDF…",
    retryGeneratePdf: "Retry Generate PDF",
    unsavedWorkWarning: "You have unsaved work. Are you sure you want to leave?",
    pdfStagePreparing: "Preparing images…",
    pdfStageProcessing: "Processing image {current} of {total}…",
    pdfStageCreating: "Creating PDF…",
    pdfStageFinalizing: "Compressing & finalizing…",
    pdfStageReady: "PDF ready!",
    pdfReadyTitle: "Your PDF is ready!",
    fileSize: "File size:",
    smallerBadge: "{percent}% smaller",
    shareWhatsApp: "📤 Share with WhatsApp",
    downloadPdfAgain: "Download PDF",

    // Notifications & Messages
    savedDetailsNotify: "Saved details: Branch {branch} · Enrollment No {enrollment}",
    pageRotatedNotify: "{page} rotated {direction}",
    rotateLeftDir: "left (90°)",
    rotateRightDir: "right (90°)",
    rotateFailedNotify: "Failed to rotate page.",
    revertedNotify: "Reverted to original photo.",
    cropAppliedNotify: "Page crop and perspective correction applied!",
    autoCropSuccessNotify: "Auto-crop applied to {count} of {total} pages.",
    branchRequiredError: "Branch is required (e.g. CE)",
    enrollmentRequiredError: "Enrollment number is required (e.g. 25002170110091)",
    subjectRequiredError: "Subject is required (e.g. DS)",
    examPhaseRequiredError: "Exam phase is required (e.g. T1)",
    uploadAtLeastOneError: "Upload at least one assignment photo",
    pdfCreatedNotify: "Assignment PDF created successfully!",
    pdfGenerateFailed: "Failed to generate PDF. Please verify your images.",
    whatsappNotify:
      "PDF downloaded! Opening WhatsApp so you can select a chat and send your assignment.",

    // Document Scanner Modal
    scannerTitle: "Document Scanner & Crop — Page {page}",
    scannerDesc:
      "Detects outer physical paper edges. All blank areas and page margins are preserved.",
    croppedBadge: "Cropped",
    adjustCornersTab: "Adjust Corners",
    straightenedPreviewTab: "Straightened Preview",
    closeScanner: "Close scanner",
    lowConfidenceWarning:
      "Outer paper boundary was ambiguous, so the full page is preserved. You can drag corner handles to crop desk background or keep full frame.",
    detectingBoundary: "Detecting physical paper boundary...",
    cornerTopLeft: "Top Left",
    cornerTopRight: "Top Right",
    cornerBottomRight: "Bottom Right",
    cornerBottomLeft: "Bottom Left",
    applyingWarp: "Applying perspective warp...",
    perspectiveStraightenedSuccess: "Perspective corrected & straightened",
    previewFailed: "Could not generate preview.",
    autoDetectPage: "Auto Detect Page",
    fullFrame: "Full Frame",
    rotateLeft: "Rotate Left",
    rotateRight: "Rotate Right",
    reset: "Reset",
    useOriginalNoCrop: "No Crop / Use Original",
    applyScan: "Apply Scan",
    applyingScan: "Applying...",

    // Profile Edit Modal
    editStudentDetailsTitle: "Edit Student Details",
    studentProfileRegistrationTitle: "Student Profile Registration",
    editStudentDetailsDesc:
      "Update your saved Branch and Enrollment Number for future PDF submissions.",
    studentProfileRegistrationDesc:
      "Save your Branch and Enrollment Number once. They will be stored in your browser and automatically used for all PDF assignments.",
    branchCodeHelp: "Your college/engineering branch code",
    enrollmentHelp: "Your student enrollment / roll number",
    cancel: "Cancel",
    saveStudentDetailsBtn: "Save Student Details",

    // Feedback
    feedbackBtn: "Feedback",
    feedbackModalTitle: "Help us improve PDFMaker",
    feedbackModalSubtitle: "Your feedback helps us make PDFMaker better.",
    feedbackTypeLabel: "Feedback Type",
    feedbackTypeFeature: "💡 Feature Request",
    feedbackTypeBug: "🐛 Bug Report",
    feedbackTypeImprovement: "✨ Improvement",
    feedbackTypeGeneral: "❤️ General Feedback",
    ratingLabel: "How would you rate your experience?",
    ratingStars: "Rating",
    feedbackMessageLabel: "Feedback Message *",
    feedbackMessagePlaceholder: "Tell us what you think...",
    charCount: "{current}/1000 characters",
    feedbackEmailLabel: "Email (optional)",
    feedbackEmailPlaceholder: "your.email@example.com",
    feedbackEmailHelp: "Optional — we'll only reach out if you'd like a follow-up.",
    submitFeedback: "Submit Feedback",
    submittingFeedback: "Submitting...",
    feedbackSuccessTitle: "Thank you! Your feedback has been submitted.",
    feedbackSuccessDesc: "We appreciate your time and input to help improve PDFMaker.",
    done: "Done",
    sendAnotherFeedback: "Send another feedback",
    feedbackEmptyError: "Please enter your feedback message before submitting.",
    feedbackEmailInvalid: "Please enter a valid email address or leave it blank.",
    feedbackSubmitError: "Failed to submit feedback. Please try again.",

    // Admin Feedback Dashboard
    adminDashboard: "Admin Feedback Dashboard",
    adminAuthTitle: "Owner / Admin Access",
    adminAuthDesc: "Enter the Owner Secret Key to view and manage student feedback.",
    adminPasskeyLabel: "Admin Security Key",
    adminPasskeyPlaceholder: "Enter security key...",
    adminLoginBtn: "Unlock Dashboard",
    adminLogoutBtn: "Lock / Logout",
    adminInvalidKey: "Invalid admin security key. Please check your credentials.",
    adminTotalFeedback: "Total Feedback",
    adminAverageRating: "Avg Rating",
    adminFilterAll: "All",
    adminFilterBugs: "Bug Reports",
    adminFilterFeatures: "Feature Requests",
    adminFilterImprovements: "Improvements",
    adminFilterGeneral: "General Feedback",
    adminNoFeedback: "No feedback submissions found.",
    adminNoFeedbackMatch: "No feedback matching this filter.",
    adminDeleteConfirm: "Delete this feedback item?",
    adminDeletedSuccess: "Feedback item deleted.",
    adminRefresh: "Refresh",
    adminPortal: "Admin Portal",
    adminSecurityNotice:
      "Owner Protected: Only authorized administrators can view feedback submissions and analytics.",
    adminTabAnalytics: "Website Analytics",
    adminTabFeedback: "Student Feedback",
    analyticsTotalUsers: "Total Users",
    analyticsTotalVisits: "Total Visits",
    analyticsTodayUsers: "Today's Users",
    analyticsTodayVisits: "Today's Visits",
    analyticsLastActivity: "Last Activity",
    analyticsTrafficActivity: "Visitor Traffic & Activity",
    analyticsDaily: "Daily (14 Days)",
    analyticsWeekly: "Weekly (8 Weeks)",
    analyticsMonthly: "Monthly (6 Months)",
    analyticsUniqueUsersDesc: "Unique anonymous visitors recorded across devices",
    analyticsTotalVisitsDesc: "Total website sessions / visits recorded",
    analyticsNoData: "No visitor analytics data recorded yet.",
    analyticsActiveNow: "Active recently",
  },
  hi: {
    // Header & App Identity
    appTitle: "असाइनमेंट PDF मेकर",
    appTagline: "विद्यार्थी टूलकिट",
    appDescription:
      "असाइनमेंट फोटो अपलोड करें, पेज बॉर्डर स्वतः पहचानें, पर्सपेक्टिव क्रॉप करें और सबमिशन के लिए तैयार PDF डाउनलोड करें।",
    settings: "सेटिंग्स",
    theme: "थीम",
    lightMode: "लाइट",
    darkMode: "डार्क",
    language: "भाषा",
    englishUs: "English (US)",
    hindi: "हिन्दी (Hindi)",
    gujarati: "ગુજરાતી (Gujarati)",
    savedProfile: "सुरक्षित प्रोफ़ाइल",
    saveStudentProfile: "विद्यार्थी प्रोफ़ाइल सेव करें",
    editProfile: "बदलें",
    editProfileTitle: "ब्रांच और एनरोलमेंट नंबर बदलें",
    profileActive: "प्रोफ़ाइल सक्रिय",

    // Step 1: Upload Photos
    step1Title: "1. असाइनमेंट फोटो अपलोड करें",
    smartFilter: "स्मार्ट फ़िल्टर",
    smartFilterTooltip: "टेक्स्ट का कंट्रास्ट, ब्राइटनेस और स्पष्टता स्वतः बढ़ाता है",
    on: "चालू",
    off: "बंद",
    autoCropAll: "सभी ऑटो-क्रॉप करें",
    scanningPages: "स्कैन हो रहा है...",
    uploadPrompt: "JPG या PNG फोटो जोड़ने के लिए टैप करें",
    uploadSubtext: "आप एक साथ कई पेज चुन सकते हैं",
    uploadedPagesHeader: "अपलोड किए गए पेज ({count}) — क्रम 1 से {count}",
    reverseOrder: "उल्टा क्रम करें",
    reverseOrderTooltip: "वर्तमान पेज क्रम को उल्टा करें (पेज 1 ↔ पेज N)",
    orderReversedNotify: "पेज का क्रम उल्टा किया गया (1 से {count})",
    pageInPdf: "PDF में पेज {num}",
    scannedAndCropped: "स्कैन व क्रॉप किया गया",
    originalPhoto: "मूल फोटो",
    scanCropBtn: "स्कैन / क्रॉप",
    rotateLeftTitle: "बाएं 90° घुमाएं (घड़ी की उल्टी दिशा)",
    rotateRightTitle: "दाएं 90° घुमाएं (घड़ी की दिशा)",
    revertToOriginalTitle: "मूल फोटो पर वापस जाएं",
    moveUpTitle: "ऊपर ले जाएं",
    moveDownTitle: "नीचे ले जाएं",
    deletePhotoTitle: "फोटो हटाएं",

    // Step 2: Submission Details
    step2Title: "2. सबमिशन विवरण",
    step2DescSaved:
      "आपकी ब्रांच और एनरोलमेंट नंबर इस ब्राउज़र में सुरक्षित हैं। बस विषय और परीक्षा चरण दर्ज करें।",
    step2DescNew:
      "एक बार अपनी ब्रांच और एनरोलमेंट नंबर दर्ज करें। भविष्य के असाइनमेंट के लिए वे इस ब्राउज़र में सुरक्षित रहेंगे।",
    savedStudentProfile: "सुरक्षित विद्यार्थी प्रोफ़ाइल",
    savedInBrowser: "(ब्राउज़र में सुरक्षित)",
    branchLabel: "ब्रांच:",
    enrollNoLabel: "एनरोलमेंट नं.:",
    editDetailsBtn: "विवरण बदलें",
    oneTimeSetup: "1-बार विद्यार्थी प्रोफ़ाइल सेटअप",
    savesInBrowser: "आपके ब्राउज़र में सुरक्षित रहता है",
    branchRequired: "ब्रांच *",
    branchPlaceholder: "उदा. CE, IT, ME",
    enrollmentRequired: "एनरोलमेंट नंबर *",
    enrollmentPlaceholder: "उदा. 25002170110091",
    saveDetailsFuture: "भविष्य के लिए विवरण सुरक्षित करें",
    subjectRequired: "विषय *",
    subjectPlaceholder: "उदा. DS",
    subjectExample: "उदाहरण: DS, Java-2, TOC, DCN",
    examPhaseRequired: "परीक्षा चरण *",
    examPhasePlaceholder: "उदा. T1",
    examPhaseExample: "उदाहरण: T1, T2, T3, Assignment-1",

    // Step 3: Preview & Download
    step3Title: "3. प्रीव्यू और डाउनलोड",
    pagesInFinalPdf: "अंतिम PDF में {count} {pageWord} होंगे",
    pageSingle: "पेज",
    pagePlural: "पेज",
    targetFilename: "फ़ाइल का नाम:",
    emptyPreviewPlaceholder: "आपके अपलोड किए गए पेज यहां दिखाई देंगे।",
    compressionAndQuality: "कंप्रेशन और गुणवत्ता",
    standardPreset: "स्टैंडर्ड",
    highPreset: "उच्च",
    compactPreset: "कॉम्पैक्ट",
    standardQualityBadge: "संतुलित",
    highQualityBadge: "सर्वोत्तम स्पष्टता",
    compactQualityBadge: "न्यूनतम साइज़",
    standardQualityDesc: "सामान्य कंप्रेशन, सामान्य सबमिशन के लिए उपयुक्त।",
    highQualityDesc: "न्यूनतम कंप्रेशन, आरेखों के लिए उच्चतम स्पष्टता।",
    compactQualityDesc: "अधिकतम कंप्रेशन, पोर्टल सीमा के लिए छोटी फ़ाइल साइज़।",
    generateDownloadPdf: "PDF बनाएं और डाउनलोड करें",
    generatingPdf: "PDF बन रहा है…",
    retryGeneratePdf: "पुनः PDF बनाएं",
    unsavedWorkWarning: "आपका असाइनमेंट सहेजा नहीं गया है। क्या आप वाकई यह पृष्ठ छोड़ना चाहते हैं?",
    pdfStagePreparing: "फ़ोटो तैयार किए जा रहे हैं…",
    pdfStageProcessing: "छवि {current}/{total} प्रोसेस हो रही है…",
    pdfStageCreating: "PDF बनाई जा रही है…",
    pdfStageFinalizing: "फ़ाइनल कंप्रेस किया जा रहा है…",
    pdfStageReady: "PDF तैयार है!",
    pdfReadyTitle: "आपकी PDF तैयार है!",
    fileSize: "फ़ाइल साइज़:",
    smallerBadge: "{percent}% छोटा",
    shareWhatsApp: "📤 WhatsApp पर शेयर करें",
    downloadPdfAgain: "PDF डाउनलोड करें",

    // Notifications & Messages
    savedDetailsNotify: "विवरण सुरक्षित: ब्रांच {branch} · एनरोलमेंट नं {enrollment}",
    pageRotatedNotify: "{page} {direction} घुमाया गया",
    rotateLeftDir: "बाएं (90°)",
    rotateRightDir: "दाएं (90°)",
    rotateFailedNotify: "पेज घुमाने में विफल।",
    revertedNotify: "मूल फोटो पर वापस लौटे।",
    cropAppliedNotify: "पेज क्रॉप और पर्सपेक्टिव सुधार लागू किया गया!",
    autoCropSuccessNotify: "{total} में से {count} पेजों पर ऑटो-क्रॉप लागू हुआ।",
    branchRequiredError: "ब्रांच आवश्यक है (उदा. CE)",
    enrollmentRequiredError: "एनरोलमेंट नंबर आवश्यक है (उदा. 25002170110091)",
    subjectRequiredError: "विषय आवश्यक है (उदा. DS)",
    examPhaseRequiredError: "परीक्षा चरण आवश्यक है (उदा. T1)",
    uploadAtLeastOneError: "कम से कम एक असाइनमेंट फोटो अपलोड करें",
    pdfCreatedNotify: "असाइनमेंट PDF सफलतापूर्वक बनाई गई!",
    pdfGenerateFailed: "PDF बनाने में विफल। कृपया अपनी छवियों की जांच करें।",
    whatsappNotify: "PDF डाउनलोड हो गई! WhatsApp खोल रहे हैं ताकि आप चैट चुनकर भेज सकें।",

    // Document Scanner Modal
    scannerTitle: "दस्तावेज़ स्कैनर और क्रॉप — पेज {page}",
    scannerDesc:
      "कागज़ के बाहरी किनारों को पहचानता है। सभी खाली हिस्से और मार्जिन सुरक्षित रहते हैं।",
    croppedBadge: "क्रॉप किया गया",
    adjustCornersTab: "कोने समायोजित करें",
    straightenedPreviewTab: "सीधा किया गया प्रीव्यू",
    closeScanner: "स्कैनर बंद करें",
    lowConfidenceWarning:
      "कागज़ की सीमा अस्पष्ट थी, इसलिए पूरा पेज सुरक्षित रखा गया है। आप कोनों को खींचकर समायोजित कर सकते हैं।",
    detectingBoundary: "कागज़ की सीमा पहचानी जा रही है...",
    cornerTopLeft: "ऊपर बायां",
    cornerTopRight: "ऊपर दायां",
    cornerBottomRight: "नीचे दायां",
    cornerBottomLeft: "नीचे बायां",
    applyingWarp: "पर्सपेक्टिव सीधा किया जा रहा है...",
    perspectiveStraightenedSuccess: "पर्सपेक्टिव सुधारा व सीधा किया गया",
    previewFailed: "प्रीव्यू नहीं बनाया जा सका।",
    autoDetectPage: "पेज स्वतः पहचानें",
    fullFrame: "पूरा फ्रेम",
    rotateLeft: "बाएं घुमाएं",
    rotateRight: "दाएं घुमाएं",
    reset: "रीसेट",
    useOriginalNoCrop: "क्रॉप न करें / मूल रखें",
    applyScan: "स्कैन लागू करें",
    applyingScan: "लागू हो रहा है...",

    // Profile Edit Modal
    editStudentDetailsTitle: "विद्यार्थी विवरण संपादित करें",
    studentProfileRegistrationTitle: "विद्यार्थी प्रोफ़ाइल पंजीकरण",
    editStudentDetailsDesc:
      "भविष्य के PDF सबमिशन के लिए अपनी सुरक्षित ब्रांच और एनरोलमेंट नंबर अपडेट करें।",
    studentProfileRegistrationDesc:
      "एक बार अपनी ब्रांच और एनरोलमेंट नंबर सुरक्षित करें। वे आपके ब्राउज़र में स्टोर हो जाएंगे और सभी असाइनमेंट के लिए उपयोग होंगे।",
    branchCodeHelp: "आपका कॉलेज / इंजीनियरिंग ब्रांच कोड",
    enrollmentHelp: "आपका विद्यार्थी एनरोलमेंट / रोल नंबर",
    cancel: "रद्द करें",
    saveStudentDetailsBtn: "विद्यार्थी विवरण सुरक्षित करें",

    // Feedback
    feedbackBtn: "फीडबैक",
    feedbackModalTitle: "PDFMaker को बेहतर बनाने में मदद करें",
    feedbackModalSubtitle: "आपकी प्रतिक्रिया हमें PDFMaker को और बेहतर बनाने में मदद करती है।",
    feedbackTypeLabel: "प्रतिक्रिया का प्रकार",
    feedbackTypeFeature: "💡 नई सुविधा का अनुरोध",
    feedbackTypeBug: "🐛 बग रिपोर्ट (समस्या)",
    feedbackTypeImprovement: "✨ सुधार का सुझाव",
    feedbackTypeGeneral: "❤️ सामान्य प्रतिक्रिया",
    ratingLabel: "आपका अनुभव कैसा रहा?",
    ratingStars: "रेटिंग",
    feedbackMessageLabel: "प्रतिक्रिया संदेश *",
    feedbackMessagePlaceholder: "हमें बताएं कि आप क्या सोचते हैं...",
    charCount: "{current}/1000 अक्षर",
    feedbackEmailLabel: "ईमेल (वैकल्पिक)",
    feedbackEmailPlaceholder: "your.email@example.com",
    feedbackEmailHelp: "वैकल्पिक — केवल यदि आप फॉलो-अप चाहते हैं तो ही हम संपर्क करेंगे।",
    submitFeedback: "प्रतिक्रिया सबमिट करें",
    submittingFeedback: "सबमिट हो रहा है...",
    feedbackSuccessTitle: "धन्यवाद! आपकी प्रतिक्रिया सबमिट कर दी गई है।",
    feedbackSuccessDesc:
      "PDFMaker को और बेहतर बनाने के लिए आपके इनपुट और समय की हम सराहना करते हैं।",
    done: "पूर्ण",
    sendAnotherFeedback: "एक और प्रतिक्रिया भेजें",
    feedbackEmptyError: "कृपया सबमिट करने से पहले अपनी प्रतिक्रिया दर्ज करें।",
    feedbackEmailInvalid: "कृपया एक मान्य ईमेल पता दर्ज करें या इसे खाली छोड़ दें।",
    feedbackSubmitError: "प्रतिक्रिया सबमिट करने में विफल। कृपया पुनः प्रयास करें।",

    // Admin Feedback Dashboard
    adminDashboard: "एडमिन फीडबैक डैशबोर्ड",
    adminAuthTitle: "मालिक / एडमिन एक्सेस",
    adminAuthDesc:
      "छात्रों की प्रतिक्रिया देखने और प्रबंधित करने के लिए एडमिन सीक्रेट की दर्ज करें।",
    adminPasskeyLabel: "एडमिन सुरक्षा कुंजी (Security Key)",
    adminPasskeyPlaceholder: "सुरक्षा कुंजी दर्ज करें...",
    adminLoginBtn: "डैशबोर्ड अनलॉक करें",
    adminLogoutBtn: "लॉग आउट / लॉक",
    adminInvalidKey: "अमान्य सुरक्षा कुंजी। कृपया सही कुंजी दर्ज करें।",
    adminTotalFeedback: "कुल प्रतिक्रियाएँ",
    adminAverageRating: "औसत रेटिंग",
    adminFilterAll: "सभी",
    adminFilterBugs: "बग रिपोर्ट्स",
    adminFilterFeatures: "सुविधा अनुरोध",
    adminFilterImprovements: "सुधार",
    adminFilterGeneral: "सामान्य प्रतिक्रिया",
    adminNoFeedback: "कोई प्रतिक्रिया नहीं मिली।",
    adminNoFeedbackMatch: "इस फ़िल्टर से कोई प्रतिक्रिया मेल नहीं खाती।",
    adminDeleteConfirm: "क्या आप इस प्रतिक्रिया को हटाना चाहते हैं?",
    adminDeletedSuccess: "प्रतिक्रिया हटा दी गई।",
    adminRefresh: "रिफ्रेश",
    adminPortal: "एडमिन पोर्टल",
    adminSecurityNotice:
      "सुरक्षित पोर्टल: केवल अधिकृत एडमिन ही प्रतिक्रियाएँ और एनालिटिक्स देख सकते हैं।",
    adminTabAnalytics: "वेबसाइट एनालिटिक्स",
    adminTabFeedback: "छात्र प्रतिक्रियाएँ",
    analyticsTotalUsers: "कुल उपयोगकर्ता",
    analyticsTotalVisits: "कुल विज़िट",
    analyticsTodayUsers: "आज के उपयोगकर्ता",
    analyticsTodayVisits: "आज की विज़िट",
    analyticsLastActivity: "अंतिम गतिविधि",
    analyticsTrafficActivity: "विज़िटर ट्रैफ़िक और गतिविधि",
    analyticsDaily: "दैनिक (14 दिन)",
    analyticsWeekly: "साप्ताहिक (8 सप्ताह)",
    analyticsMonthly: "मासिक (6 महीने)",
    analyticsUniqueUsersDesc: "सभी डिवाइसों में रिकॉर्ड किए गए अनाम विज़िटर",
    analyticsTotalVisitsDesc: "रिकॉर्ड किए गए कुल वेबसाइट सेशन / विज़िट",
    analyticsNoData: "अभी तक कोई विज़िटर एनालिटिक्स डेटा रिकॉर्ड नहीं हुआ।",
    analyticsActiveNow: "हाल ही में सक्रिय",
  },
  gu: {
    // Header & App Identity
    appTitle: "અસાઇનમેન્ટ PDF મેકર",
    appTagline: "વિદ્યાર્થી ટૂલકિટ",
    appDescription:
      "અસાઇનમેન્ટ ફોટા અપલોડ કરો, પેજ બોર્ડર આપમેળે શોધો, પર્સ્પેક્ટિવ ક્રોપ કરો અને સબમિશન માટે તૈયાર PDF ડાઉનલોડ કરો.",
    settings: "સેટિંગ્સ",
    theme: "થીમ",
    lightMode: "લાઇટ",
    darkMode: "ડાર્ક",
    language: "ભાષા",
    englishUs: "English (US)",
    hindi: "हिन्दी (Hindi)",
    gujarati: "ગુજરાતી (Gujarati)",
    savedProfile: "સેવ કરેલ પ્રોફાઇલ",
    saveStudentProfile: "વિદ્યાર્થી પ્રોફાઇલ સેવ કરો",
    editProfile: "બદલો",
    editProfileTitle: "બ્રાન્ચ અને એનરોલમેન્ટ નંબર બદલો",
    profileActive: "પ્રોફાઇલ સક્રિય",

    // Step 1: Upload Photos
    step1Title: "1. અસાઇનમેન્ટ ફોટા અપલોડ કરો",
    smartFilter: "સ્માર્ટ ફિલ્ટર",
    smartFilterTooltip: "ટેક્સ્ટનો કોન્ટ્રાસ્ટ, બ્રાઇટનેસ અને સ્પષ્ટતા આપમેળે વધારે છે",
    on: "ચાલુ",
    off: "બંધ",
    autoCropAll: "બધા ઓટો-ક્રોપ કરો",
    scanningPages: "સ્કેન થઈ રહ્યું છે...",
    uploadPrompt: "JPG અથવા PNG ફોટા ઉમેરવા માટે ટેપ કરો",
    uploadSubtext: "તમે એકસાથે ઘણા પેજ પસંદ કરી શકો છો",
    uploadedPagesHeader: "અપલોડ કરેલા પેજ ({count}) — ક્રમ 1 થી {count}",
    reverseOrder: "ઊંધો ક્રમ કરો",
    reverseOrderTooltip: "હાલનો પેજ ક્રમ ઊંધો કરો (પેજ 1 ↔ પેજ N)",
    orderReversedNotify: "પેજનો ક્રમ ઊંધો કરવામાં આવ્યો (1 થી {count})",
    pageInPdf: "PDF માં પેજ {num}",
    scannedAndCropped: "સ્કેન અને ક્રોપ કરેલ",
    originalPhoto: "મૂળ ફોટો",
    scanCropBtn: "સ્કેન / ક્રોપ",
    rotateLeftTitle: "ડાબે 90° ફેરવો (ઘડિયાળની ઊંધી દિશા)",
    rotateRightTitle: "જમણે 90° ફેરવો (ઘડિયાળની દિશા)",
    revertToOriginalTitle: "મૂળ ફોટા પર પાછા જાઓ",
    moveUpTitle: "ઉપર ખસેડો",
    moveDownTitle: "નીચે ખસેડો",
    deletePhotoTitle: "ફોટો કાઢી નાખો",

    // Step 2: Submission Details
    step2Title: "2. સબમિશન વિગતો",
    step2DescSaved:
      "તમારી બ્રાન્ચ અને એનરોલમેન્ટ નંબર આ બ્રાઉઝરમાં સેવ છે. માત્ર વિષય અને પરીક્ષા ફેઝ દાખલ કરો.",
    step2DescNew:
      "એકવાર તમારી બ્રાન્ચ અને એનરોલમેન્ટ નંબર દાખલ કરો. ભવિષ્યના અસાઇનમેન્ટ માટે તે આ બ્રાઉઝરમાં સેવ રહેશે.",
    savedStudentProfile: "સેવ કરેલ વિદ્યાર્થી પ્રોફાઇલ",
    savedInBrowser: "(બ્રાઉઝરમાં સેવ છે)",
    branchLabel: "બ્રાન્ચ:",
    enrollNoLabel: "એનરોલમેન્ટ નં.:",
    editDetailsBtn: "વિગતો બદલો",
    oneTimeSetup: "1-વખત વિદ્યાર્થી પ્રોફાઇલ સેટઅપ",
    savesInBrowser: "તમારા બ્રાઉઝરમાં સેવ રહે છે",
    branchRequired: "બ્રાન્ચ *",
    branchPlaceholder: "દા.ત. CE, IT, ME",
    enrollmentRequired: "એનરોલમેન્ટ નંબર *",
    enrollmentPlaceholder: "દા.ત. 25002170110091",
    saveDetailsFuture: "ભવિષ્ય માટે વિગતો સેવ કરો",
    subjectRequired: "વિષય *",
    subjectPlaceholder: "દા.ત. DS",
    subjectExample: "ઉદાહરણ: DS, Java-2, TOC, DCN",
    examPhaseRequired: "પરીક્ષા ફેઝ *",
    examPhasePlaceholder: "દા.ત. T1",
    examPhaseExample: "ઉદાહરણ: T1, T2, T3, Assignment-1",

    // Step 3: Preview & Download
    step3Title: "3. પ્રીવ્યૂ અને ડાઉનલોડ",
    pagesInFinalPdf: "અંતિમ PDF માં {count} {pageWord} હશે",
    pageSingle: "પેજ",
    pagePlural: "પેજ",
    targetFilename: "ફાઇલનું નામ:",
    emptyPreviewPlaceholder: "તમારા અપલોડ કરેલા પેજ અહીં દેખાશે.",
    compressionAndQuality: "કમ્પ્રેશન અને ગુણવત્તા",
    standardPreset: "સ્ટાન્ડર્ડ",
    highPreset: "ઉચ્ચ",
    compactPreset: "કોમ્પેક્ટ",
    standardQualityBadge: "સંતુલિત",
    highQualityBadge: "સૌથી સ્પષ્ટ",
    compactQualityBadge: "સૌથી નાની સાઇઝ",
    standardQualityDesc: "સામાન્ય કમ્પ્રેશન, સામાન્ય સબમિશન માટે યોગ્ય.",
    highQualityDesc: "ન્યૂનતમ કમ્પ્રેશન, આકૃતિઓ માટે ઉચ્ચતમ સ્પષ્ટતા.",
    compactQualityDesc: "મહત્તમ કમ્પ્રેશન, પોર્ટલ મર્યાદા માટે નાની ફાઇલ સાઇઝ.",
    generateDownloadPdf: "PDF બનાવો અને ડાઉનલોડ કરો",
    generatingPdf: "PDF બની રહી છે…",
    retryGeneratePdf: "ફરીથી PDF બનાવો",
    unsavedWorkWarning: "તમારું કાર્ય સેવ થયેલ નથી. શું તમે ખરેખર પેજ છોડવા માંગો છો?",
    pdfStagePreparing: "ફોટા તૈયાર થઈ રહ્યા છે…",
    pdfStageProcessing: "ઇમેજ {current}/{total} પ્રોસેસ થઈ રહી છે…",
    pdfStageCreating: "PDF બની રહી છે…",
    pdfStageFinalizing: "ફાઇનલ કમ્પ્રેસ થઈ રહ્યું છે…",
    pdfStageReady: "PDF તૈયાર છે!",
    pdfReadyTitle: "તમારી PDF તૈયાર છે!",
    fileSize: "ફાઇલ સાઇઝ:",
    smallerBadge: "{percent}% નાની",
    shareWhatsApp: "📤 WhatsApp પર શેર કરો",
    downloadPdfAgain: "PDF ડાઉનલોડ કરો",

    // Notifications & Messages
    savedDetailsNotify: "વિગતો સેવ થઈ: બ્રાન્ચ {branch} · એનરોલમેન્ટ નં {enrollment}",
    pageRotatedNotify: "{page} {direction} ફેરવવામાં આવ્યું",
    rotateLeftDir: "ડાબે (90°)",
    rotateRightDir: "જમણે (90°)",
    rotateFailedNotify: "પેજ ફેરવવામાં નિષ્ફળ.",
    revertedNotify: "મૂળ ફોટા પર પાછા ફર્યા.",
    cropAppliedNotify: "પેજ ક્રોપ અને પર્સ્પેક્ટિવ સુધારો લાગુ થયો!",
    autoCropSuccessNotify: "{total} માંથી {count} પેજ પર ઓટો-ક્રોપ લાગુ થયું.",
    branchRequiredError: "બ્રાન્ચ જરૂરી છે (દા.ત. CE)",
    enrollmentRequiredError: "એનરોલમેન્ટ નંબર જરૂરી છે (દા.ત. 25002170110091)",
    subjectRequiredError: "વિષય જરૂરી છે (દા.ત. DS)",
    examPhaseRequiredError: "પરીક્ષા ફેઝ જરૂરી છે (દા.ત. T1)",
    uploadAtLeastOneError: "ઓછામાં ઓછો એક અસાઇનમેન્ટ ફોટો અપલોડ કરો",
    pdfCreatedNotify: "અસાઇનમેન્ટ PDF સફળતાપૂર્વક બની ગઈ!",
    pdfGenerateFailed: "PDF બનાવવામાં નિષ્ફળ. કૃપા કરીને તમારી છબીઓ તપાસો.",
    whatsappNotify: "PDF ડાઉનલોડ થઈ ગઈ! WhatsApp ખોલી રહ્યા છીએ જેથી તમે ચેટ પસંદ કરીને મોકલી શકો.",

    // Document Scanner Modal
    scannerTitle: "દસ્તાવેજ સ્કેનર અને ક્રોપ — પેજ {page}",
    scannerDesc: "કાગળની બહારની ધાર ઓળખે છે. તમામ ખાલી વિસ્તારો અને માર્જિન સાચવેલ રહે છે.",
    croppedBadge: "ક્રોપ કરેલ",
    adjustCornersTab: "ખૂણા ગોઠવો",
    straightenedPreviewTab: "સીધું કરેલ પ્રીવ્યૂ",
    closeScanner: "સ્કેનર બંધ કરો",
    lowConfidenceWarning:
      "કાગળની સીમા અસ્પષ્ટ હતી, તેથી આખું પેજ સાચવી રાખવામાં આવ્યું છે. તમે ખૂણા ખેંચીને ક્રોપ કરી શકો છો.",
    detectingBoundary: "કાગળની સીમા ઓળખાઈ રહી છે...",
    cornerTopLeft: "ઉપર ડાબે",
    cornerTopRight: "ઉપર જમણે",
    cornerBottomRight: "નીચે જમણે",
    cornerBottomLeft: "નીચે ડાબે",
    applyingWarp: "પર્સ્પેક્ટિવ સીધું થઈ રહ્યું છે...",
    perspectiveStraightenedSuccess: "પર્સ્પેક્ટિવ સુધારીને સીધું કરવામાં આવ્યું",
    previewFailed: "પ્રીવ્યૂ બનાવી શકાયું નથી.",
    autoDetectPage: "પેજ આપમેળે શોધો",
    fullFrame: "આખો ફ્રેમ",
    rotateLeft: "ડાબે ફેરવો",
    rotateRight: "જમણે ફેરવો",
    reset: "રીસેટ",
    useOriginalNoCrop: "ક્રોપ ન કરો / મૂળ રાખો",
    applyScan: "સ્કેન લાગુ કરો",
    applyingScan: "લાગુ થઈ રહ્યું છે...",

    // Profile Edit Modal
    editStudentDetailsTitle: "વિદ્યાર્થી વિગતો સંપાદિત કરો",
    studentProfileRegistrationTitle: "વિદ્યાર્થી પ્રોફાઇલ નોંધણી",
    editStudentDetailsDesc:
      "ભવિષ્યના PDF સબમિશન માટે તમારી સેવ કરેલી બ્રાન્ચ અને એનરોલમેન્ટ નંબર અપડેટ કરો.",
    studentProfileRegistrationDesc:
      "એકવાર તમારી બ્રાન્ચ અને એનરોલમેન્ટ નંબર સેવ કરો. તે તમારા બ્રાઉઝરમાં સ્ટોર થશે અને તમામ અસાઇનમેન્ટ માટે વપરાશે.",
    branchCodeHelp: "તમારો કોલેજ / એન્જિનિયરિંગ બ્રાન્ચ કોડ",
    enrollmentHelp: "તમારો વિદ્યાર્થી એનરોલમેન્ટ / રોલ નંબર",
    cancel: "રદ કરો",
    saveStudentDetailsBtn: "વિદ્યાર્થી વિગતો સેવ કરો",

    // Feedback
    feedbackBtn: "પ્રતિસાદ",
    feedbackModalTitle: "PDFMaker ને વધુ સારું બનાવવામાં મદદ કરો",
    feedbackModalSubtitle: "તમારો પ્રતિસાદ અમને PDFMaker ને વધુ સારું બનાવવામાં મદદ કરે છે.",
    feedbackTypeLabel: "પ્રતિસાદનો પ્રકાર",
    feedbackTypeFeature: "💡 નવી સુવિધા વિનંતી",
    feedbackTypeBug: "🐛 બગ રિપોર્ટ (સમસ્યા)",
    feedbackTypeImprovement: "✨ સુધારાનું સૂચન",
    feedbackTypeGeneral: "❤️ સામાન્ય પ્રતિસાદ",
    ratingLabel: "તમારો અનુભવ કેવો રહ્યો?",
    ratingStars: "રેટિંગ",
    feedbackMessageLabel: "પ્રતિસાદ સંદેશ *",
    feedbackMessagePlaceholder: "અમને જણાવો કે તમે શું વિચારો છો...",
    charCount: "{current}/1000 અક્ષરો",
    feedbackEmailLabel: "ઈમેલ (વૈકલ્પિક)",
    feedbackEmailPlaceholder: "your.email@example.com",
    feedbackEmailHelp: "વૈકલ્પિક — જો તમે ફોલો-અપ ઇચ્છતા હોવ તો જ અમે સંપર્ક કરીશું.",
    submitFeedback: "પ્રતિસાદ સબમિટ કરો",
    submittingFeedback: "સબમિટ થઈ રહ્યું છે...",
    feedbackSuccessTitle: "આભાર! તમારો પ્રતિસાદ સબમિટ થઈ ગયો છે.",
    feedbackSuccessDesc:
      "PDFMaker ને વધુ સારું બનાવવા માટે તમારા ઇનપુટ અને સમયની અમે પ્રશંસા કરીએ છીએ.",
    done: "પૂર્ણ",
    sendAnotherFeedback: "બીજો પ્રતિસાદ મોકલો",
    feedbackEmptyError: "કૃપા કરીને સબમિટ કરતા પહેલાં તમારો પ્રતિસાદ દાખલ કરો.",
    feedbackEmailInvalid: "કૃપા કરીને માન્ય ઈમેલ સરનામું દાખલ કરો અથવા ખાલી રાખો.",
    feedbackSubmitError: "પ્રતિસાદ સબમિટ કરવામાં નિષ્ફળ. કૃપા કરીને ફરી પ્રયાસ કરો.",

    // Admin Feedback Dashboard
    adminDashboard: "એડમિન પ્રતિસાદ ડેશબોર્ડ",
    adminAuthTitle: "ઓનર / એડમિન એક્સેસ",
    adminAuthDesc: "વિદ્યાર્થી પ્રતિસાદ જોવા અને સંચાલિત કરવા માટે સિક્યુરિટી કી દાખલ કરો.",
    adminPasskeyLabel: "એડમિન સિક્યુરિટી કી (Security Key)",
    adminPasskeyPlaceholder: "સિક્યુરિટી કી દાખલ કરો...",
    adminLoginBtn: "ડેશબોર્ડ અનલૉક કરો",
    adminLogoutBtn: "લૉગ આઉટ / લૉક",
    adminInvalidKey: "અમાન્ય સિક્યુરિટી કી. કૃપા કરીને ચકાસો.",
    adminTotalFeedback: "કુલ પ્રતિસાદ",
    adminAverageRating: "સરેરાશ રેટિંગ",
    adminFilterAll: "બધા",
    adminFilterBugs: "બગ રિપોર્ટ્સ",
    adminFilterFeatures: "સુવિધા વિનંતી",
    adminFilterImprovements: "સુધારાઓ",
    adminFilterGeneral: "સામાન્ય પ્રતિસાદ",
    adminNoFeedback: "કોઈ પ્રતિસાદ મળ્યો નથી.",
    adminNoFeedbackMatch: "આ ફિલ્ટર સાથે કોઈ પ્રતિસાદ મેળ ખાતો નથી.",
    adminDeleteConfirm: "શું તમે આ પ્રતિસાદ કાઢી નાખવા માંગો છો?",
    adminDeletedSuccess: "પ્રતિસાદ કાઢી નાખવામાં આવ્યો.",
    adminRefresh: "રીફ્રેશ",
    adminPortal: "એડમિન પોર્ટલ",
    adminSecurityNotice:
      "સુરક્ષિત પોર્ટલ: માત્ર અધિકૃત એડમિનિસ્ટ્રેટર જ પ્રતિસાદ અને એનાલિટિક્સ જોઈ શકે છે.",
    adminTabAnalytics: "વેબસાઇટ એનાલિટિક્સ",
    adminTabFeedback: "વિદ્યાર્થી પ્રતિસાદ",
    analyticsTotalUsers: "કુલ વપરાશકર્તાઓ",
    analyticsTotalVisits: "કુલ મુલાકાતો",
    analyticsTodayUsers: "આજના વપરાશકર્તાઓ",
    analyticsTodayVisits: "આજની મુલાકાતો",
    analyticsLastActivity: "છેલ્લી પ્રવૃત્તિ",
    analyticsTrafficActivity: "મુલાકાતી ટ્રાફિક અને પ્રવૃત્તિ",
    analyticsDaily: "દૈનિક (14 દિવસ)",
    analyticsWeekly: "સાપ્તાહિક (8 અઠવાડિયા)",
    analyticsMonthly: "માસિક (6 મહિના)",
    analyticsUniqueUsersDesc: "બધા ઉપકરણોમાં નોંધાયેલ અનામી મુલાકાતીઓ",
    analyticsTotalVisitsDesc: "નોંધાયેલ કુલ વેબસાઇટ સત્રો / મુલાકાતો",
    analyticsNoData: "હજુ સુધી કોઈ મુલાકાતી એનાલિટિક્સ ડેટા મળ્યો નથી.",
    analyticsActiveNow: "તાજેતરમાં સક્રિય",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Explicit DEFAULT: English (United States) / en (Never auto-detected from phone locale)
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
      if (saved && (saved === "en" || saved === "hi" || saved === "gu")) {
        setLanguageState(saved);
      } else {
        setLanguageState("en");
      }
    } catch {
      setLanguageState("en");
    }
  }, []);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch {
      // safe ignore
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const langDict = translations[language] || translations.en;
    let str: string =
      (langDict as Record<string, string>)[key] ||
      (translations.en as Record<string, string>)[key] ||
      key;
    if (params) {
      Object.entries(params).forEach(([pKey, pVal]) => {
        str = str.replaceAll(`{${pKey}}`, String(pVal));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
