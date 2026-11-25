export type EventInput = {
  date: string;
  details: string;
};

export type SavedEvent = EventInput & {
  id: string;
  createdAt: string;
};
