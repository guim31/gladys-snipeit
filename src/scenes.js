// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): the deadlines of the week, for a
// Monday message or a vocal reminder.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  read_week(hub) {
    return hub.readWeek();
  },
};
