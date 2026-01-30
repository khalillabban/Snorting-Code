import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import CampusMap from "../components/CampusMap";
import { CAMPUSES, CampusKey } from "../constants/campuses";
import * as Location from "expo-location";
import { useEffect } from "react";

export default function CampusMapScreen() {
    useEffect(() => {
        (async () => {
            await Location.requestForegroundPermissionsAsync();
        })();
    }, []);
    const { campus } = useLocalSearchParams<{ campus?: CampusKey }>();

    if (!campus || !(campus in CAMPUSES)) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text>Invalid campus</Text>
            </View>
        );
    }

    const campusData = CAMPUSES[campus];

    return (
        <View style={{ flex: 1 }}>
            <CampusMap coordinates={campusData.coordinates} />
        </View>
    );
}
