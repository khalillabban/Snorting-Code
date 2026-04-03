import { Departure } from "@/constants/type";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { shuttleSchedule } from "../constants/shuttle";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { createStyles } from "../styles/ShuttleBar.styles";
import { getScheduleKeyForDate } from "../utils/shuttleAvailability";

type Campus = "SGW" | "Loyola";

const getNextShuttleDepartures = (
  startCampus: Campus,
  endCampus: Campus,
  limit: number = 2,
): Departure[] => {
  const now = new Date();
  const scheduleKey = getScheduleKeyForDate(now);

  if (scheduleKey === "weekend") return [];

  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

  const directionKey = `${startCampus}_to_${endCampus}` as
    | "SGW_to_Loyola"
    | "Loyola_to_SGW";

  const todaySchedule = shuttleSchedule.schedule[scheduleKey][directionKey];

  if (!todaySchedule) return [];

  return todaySchedule
    .map((shuttle) => {
      const [hours, minutes] = shuttle.departureTime.split(":").map(Number);
      const departureTimeInMinutes = hours * 60 + minutes;
      return {
        ...shuttle,
        departureTimeInMinutes,
        minutesUntilDeparture: departureTimeInMinutes - currentTimeInMinutes,
      };
    })
    .filter((shuttle) => shuttle.minutesUntilDeparture >= 0)
    .sort((a, b) => a.minutesUntilDeparture - b.minutesUntilDeparture)
    .slice(0, limit)
    .map(({ departureTime, arrivalTime }) => ({ departureTime, arrivalTime }));
};

const calculateAdjustedDepartureTime = (
  departureTime: string,
  startCampus: Campus,
  endCampus: Campus,
): string => {
  const [hours, minutes] = departureTime.split(":").map(Number);
  const departureDate = new Date();
  departureDate.setHours(hours, minutes, 0, 0);

  const now = new Date();
  const walkTime = 5 * 60 * 1000;

  if (now.getTime() + walkTime <= departureDate.getTime()) {
    return departureTime;
  }

  const departures = getNextShuttleDepartures(startCampus, endCampus, 2);
  return departures.length > 1 ? departures[1].departureTime : departureTime;
};

interface ShuttleBusProps {
  startLocation: Campus;
  endLocation: Campus;
}

const ShuttleBus = ({ startLocation, endLocation }: ShuttleBusProps) => {
  const { colors } = useColorAccessibility();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [nextDepartures, setNextDepartures] = useState<Departure[]>([]);
  const [isShuttleAvailable, setIsShuttleAvailable] = useState(false);

  useEffect(() => {
    const start = startLocation;
    const end = endLocation;

    // ONLY BETWEEN CAMPUS
    const shuttleAvailable =
      (start === "SGW" && end === "Loyola") ||
      (start === "Loyola" && end === "SGW");

    setIsShuttleAvailable(shuttleAvailable);

    if (shuttleAvailable) {
      const departures = getNextShuttleDepartures(start, end, 2);
      setNextDepartures(departures);
    } else {
      setNextDepartures([]);
    }
  }, [startLocation, endLocation]);

  if (!isShuttleAvailable) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Next Shuttle Departures</Text>
      {nextDepartures.length > 0 ? (
        nextDepartures.map((departure, index) => (
          <View
            key={`${departure.departureTime}-${departure.arrivalTime}`}
            style={styles.departureRow}
          >
            <Text style={styles.label}>Departure {index + 1}:</Text>
            <Text style={styles.time}>{departure.departureTime}</Text>
            <Text style={styles.label}>Arrives:</Text>
            <Text style={styles.time}>{departure.arrivalTime}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noShuttle}>No upcoming shuttles for today.</Text>
      )}
    </View>
  );
};

export default ShuttleBus;
export { calculateAdjustedDepartureTime, getNextShuttleDepartures };

