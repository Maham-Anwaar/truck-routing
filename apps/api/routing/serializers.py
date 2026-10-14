from datetime import timedelta

from rest_framework import serializers

from .services.geo import DEMO_NOW


class CoordSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)


class PlanRequestSerializer(serializers.Serializer):
    origin = CoordSerializer()
    destination = CoordSerializer()
    departure_utc = serializers.DateTimeField()
    load_lb = serializers.IntegerField(min_value=0, max_value=80000)
    checkpoint_spacing_mi = serializers.ChoiceField(choices=[10, 25, 50], default=25)

    def validate_departure_utc(self, value):
        lo = DEMO_NOW - timedelta(minutes=15)
        hi = DEMO_NOW + timedelta(hours=48)
        if not (lo <= value <= hi):
            raise serializers.ValidationError("Departure must be within the next 48 hours.")
        return value

    def validate(self, data):
        o, d = data["origin"], data["destination"]
        if abs(o["lat"] - d["lat"]) < 1e-6 and abs(o["lon"] - d["lon"]) < 1e-6:
            raise serializers.ValidationError("Destination must differ from origin.")
        return data
