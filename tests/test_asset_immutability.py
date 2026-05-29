"""Tests for seized asset fact immutability."""

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.database import Base
from backend.core.models import Asset, Case, FrozenValuationSnapshot


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()


def test_asset_facts_can_be_created_and_read(db_session):
    case = Case(case_id="SCFCA-CASE-ASSET-0001", wallet_ref="WLT-ASSET-0001")
    db_session.add(case)
    db_session.flush()

    asset = Asset(
        asset_id="AS-IMM-0001",
        symbol="BTC",
        network="Bitcoin",
        wallet_ref=case.wallet_ref,
        balance=Decimal("1.25000000"),
        asset_type="coin",
        protocol="native",
        case_id=case.id,
        registered_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db_session.add(asset)
    db_session.commit()

    stored = db_session.query(Asset).filter(Asset.asset_id == "AS-IMM-0001").one()
    assert stored.symbol == "BTC"
    assert stored.balance == Decimal("1.25000000")
    assert stored.wallet_ref == "WLT-ASSET-0001"


@pytest.mark.parametrize(
    ("field_name", "new_value"),
    [
        ("symbol", "ETH"),
        ("asset_type", "token"),
        ("balance", Decimal("2.00000000")),
        ("wallet_ref", "WLT-ASSET-TAMPERED"),
        ("registered_at", datetime(2026, 1, 2, 12, 0, 0)),
    ],
)
def test_persisted_asset_seized_facts_cannot_be_changed(db_session, field_name, new_value):
    asset = Asset(
        asset_id="AS-IMM-0002",
        symbol="BTC",
        network="Bitcoin",
        wallet_ref="WLT-ASSET-0002",
        balance=Decimal("1.25000000"),
        asset_type="coin",
        protocol="native",
        registered_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db_session.add(asset)
    db_session.commit()

    setattr(asset, field_name, new_value)
    with pytest.raises(ValueError, match="Asset seized facts are immutable"):
        db_session.commit()


def test_asset_status_metadata_can_change_without_mutating_seized_facts(db_session):
    asset = Asset(
        asset_id="AS-IMM-0003",
        symbol="BTC",
        network="Bitcoin",
        wallet_ref="WLT-ASSET-0003",
        balance=Decimal("1.25000000"),
        asset_type="coin",
        protocol="native",
        status="active",
        registered_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db_session.add(asset)
    db_session.commit()

    asset.status = "secured"
    db_session.commit()

    stored = db_session.query(Asset).filter(Asset.asset_id == "AS-IMM-0003").one()
    assert stored.status == "secured"
    assert stored.symbol == "BTC"
    assert stored.balance == Decimal("1.25000000")


def test_frozen_valuation_snapshot_cannot_be_changed_after_creation(db_session):
    case = Case(case_id="SCFCA-CASE-ASSET-0004", wallet_ref="WLT-ASSET-0004")
    db_session.add(case)
    db_session.flush()
    snapshot = FrozenValuationSnapshot(
        case_id=case.id,
        snapshot_time=datetime(2026, 1, 1, 13, 0, 0),
        valuation={
            "currency": "USD",
            "assets": [{"assetId": "AS-IMM-0004", "symbol": "BTC", "balance": "1.25"}],
            "totalUsd": 31250.0,
        },
    )
    db_session.add(snapshot)
    db_session.commit()

    snapshot.valuation = {
        "currency": "USD",
        "assets": [{"assetId": "AS-IMM-0004", "symbol": "BTC", "balance": "99"}],
        "totalUsd": 2475000.0,
    }
    with pytest.raises(ValueError, match="Frozen valuation snapshots are immutable"):
        db_session.commit()
