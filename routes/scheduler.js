const express = require("express");

const router = express.Router();

const schedulerController =
    require("../controllers/schedulerController");


router.post(
    "/",
    schedulerController.createSchedule
);

router.get(
    "/",
    schedulerController.getSchedules
);

router.get(
    "/calendar/:userId",
    schedulerController.getCalendarPosts
);

router.put(
    "/:id/time",
    schedulerController.updateSchedule
);

router.put(
    "/:id/caption",
    schedulerController.updateCaption
);

router.delete(
    "/:id",
    schedulerController.deleteScheduledPost
);


module.exports = router;