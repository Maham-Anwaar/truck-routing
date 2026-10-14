from rest_framework.response import Response
from rest_framework.views import APIView

from . import scoring
from .services import places as places_service


class HealthView(APIView):
    """Liveness probe for the load balancer."""

    def get(self, request):
        return Response({"status": "ok"})


class PlacesView(APIView):
    """GET /api/places — full list; GET /api/places?q= — autocomplete."""

    def get(self, request):
        q = request.query_params.get("q")
        places = places_service.all_places() if q is None else places_service.search(q)
        return Response({"places": places})


class RiskLevelsView(APIView):
    """GET /api/config/risk-levels — the risk threshold table."""

    def get(self, request):
        return Response({"levels": scoring.LEVELS_CONFIG})
