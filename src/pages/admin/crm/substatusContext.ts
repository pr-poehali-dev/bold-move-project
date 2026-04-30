import { createContext, useContext } from "react";
import type { Substatus } from "./OrdersTabs";

export const SubstatusContext = createContext<Substatus[]>([]);
export const useSubstatuses = () => useContext(SubstatusContext);
