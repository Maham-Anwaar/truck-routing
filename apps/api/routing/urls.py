from django.urls import path

from . import views

urlpatterns = [
    path("health", views.HealthView.as_view(), name="health"),
    path("places", views.PlacesView.as_view(), name="places"),
    path("config/risk-levels", views.RiskLevelsView.as_view(), name="risk-levels"),
    path("routes/plan", views.PlanView.as_view(), name="routes-plan"),
    path("weather/field", views.WeatherFieldView.as_view(), name="weather-field"),
]
