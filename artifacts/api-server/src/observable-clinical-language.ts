const OBSERVABLE_ACTION_SOURCE =
  "(?:accept(?:ed|ing|s)?|approach(?:ed|es|ing)?|bite|bit|biting|bolt(?:ed|ing|s)?|" +
  "break|broke|breaking|clap(?:ped|ping|s)?|complete(?:d|s|ing)?|contact(?:ed|ing|s)?|" +
  "cover(?:ed|ing|s)?|cry|cried|crying|drop(?:ped|ping|s)?|elope(?:d|s|ing)?|" +
  "engage(?:d|s|ing)?|exit(?:ed|ing|s)?|flap(?:ped|ping|s)?|follow(?:ed|ing|s)?|" +
  "gesture(?:d|s|ing)?|grab(?:bed|bing|s)?|hand(?:ed|ing|s)?|headbutt(?:ed|ing|s)?|" +
  "hit|hitting|initiate(?:d|s|ing)?|jump(?:ed|ing|s)?|keep|kept|kick(?:ed|ing|s)?|" +
  "lean(?:ed|ing|s)?|leave|leaves|leaving|left|look(?:ed|ing|s)?|move(?:d|s|ing)?|" +
  "nod(?:ded|ding|s)?|open(?:ed|ing|s)?|orient(?:ed|ing|s)?|pac(?:ed|es|ing)|" +
  "pick(?:ed|ing|s)?\\s+up|place(?:d|s|ing)?|point(?:ed|ing|s)?|pull(?:ed|ing|s)?|" +
  "push(?:ed|es|ing)?|reach(?:ed|es|ing)?|refuse(?:d|s|ing)?|release(?:d|s|ing)?|" +
  "remain(?:ed|ing|s)?|remove(?:d|s|ing)?|repeat(?:ed|ing|s)?|respond(?:ed|ing|s)?|" +
  "return(?:ed|ing|s)?|rip(?:ped|ping|s)?|rock(?:ed|ing|s)?|run|ran|running|" +
  "say|said|saying|sat|scratch(?:ed|es|ing)?|scream(?:ed|ing|s)?|select(?:ed|ing|s)?|" +
  "shake|shook|shaking|shout(?:ed|ing|s)?|sit|sitting|spat|spin|spinning|spun|" +
  "sprint(?:ed|ing|s)?|sit|sits|sitting|stand|standing|stood|stomp(?:ed|ing|s)?|strike|struck|" +
  "sweep|swept|sweeping|swat(?:ted|ting|s)?|tear|tearing|threw|throw(?:ing|s)?|" +
  "touch(?:ed|es|ing)?|turn(?:ed|ing|s)?|unlock(?:ed|ing|s)?|use(?:d|s)?|using|" +
  "vocalize(?:d|s|ing)?|walk(?:ed|ing|s)?|wander(?:ed|ing|s)?|wave|waved|waving|" +
  "yell(?:ed|ing|s)?|threat(?:s|en(?:ed|ing|s)?)?)";

const observableAction = new RegExp(`\\b${OBSERVABLE_ACTION_SOURCE}\\b`, "i");
const observableClientOutcome = new RegExp(
  `\\bthe client\\b[^.]{0,220}\\b${OBSERVABLE_ACTION_SOURCE}\\b`,
  "i",
);

export function containsObservableClinicalAction(text: string): boolean {
  return observableAction.test(text);
}

export function containsObservableClientOutcome(text: string): boolean {
  return observableClientOutcome.test(text);
}
