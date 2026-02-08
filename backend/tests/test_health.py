from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200


def test_health_response_shape(client: TestClient) -> None:
    data = client.get("/api/health").json()
    assert data["status"] == "healthy"
    assert data["supabase"] == "connected"
    assert "version" in data


def test_health_supabase_unreachable(
    client: TestClient,
    mock_supabase: MagicMock,
) -> None:
    mock_supabase.table.return_value.select.return_value.limit.return_value.execute.side_effect = (
        Exception("connection failed")
    )
    data = client.get("/api/health").json()
    assert data["status"] == "healthy"
    assert data["supabase"] == "unreachable"
